package proc

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// Task is one OS thread (TID) under /proc/<pid>/task/<tid>.
type Task struct {
	TID                  int    `json:"tid"`
	Comm                 string `json:"comm"`
	State                string `json:"state"`
	Processor            int    `json:"processor"` // last CPU, from /proc/.../stat field 39
	VoluntaryCtxt        int64  `json:"voluntary_ctxt_switches"`
	NonvoluntaryCtxt     int64  `json:"nonvoluntary_ctxt_switches"`
	IsThreadGroupLeader  bool   `json:"is_thread_group_leader"`
}

// ThreadSnapshot is a REAL view of OS threads for a process (+ optional app-reported goroutine count).
type ThreadSnapshot struct {
	PID              int    `json:"pid"`
	Phase            string `json:"phase,omitempty"`
	ThreadsReported  int    `json:"threads_from_status"` // /proc/<pid>/status Threads:
	Tasks            []Task `json:"tasks"`
	GoroutinesApp    int    `json:"goroutines_app,omitempty"` // from experiment stdout (Go runtime), not kernel
	GOMAXPROCS       int    `json:"gomaxprocs_app,omitempty"`
	NumCPU           int    `json:"num_cpu_app,omitempty"`
	Note             string `json:"note"`
}

// ReadTasks lists /proc/<pid>/task/* with per-thread stat+status fields.
func ReadTasks(pid int) ([]Task, error) {
	dir := filepath.Join("/proc", strconv.Itoa(pid), "task")
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	out := make([]Task, 0, len(entries))
	for _, ent := range entries {
		if !ent.IsDir() {
			continue
		}
		tid, err := strconv.Atoi(ent.Name())
		if err != nil {
			continue
		}
		t, err := readOneTask(pid, tid)
		if err != nil {
			continue
		}
		t.IsThreadGroupLeader = tid == pid
		out = append(out, t)
	}
	return out, nil
}

func readOneTask(pid, tid int) (Task, error) {
	base := filepath.Join("/proc", strconv.Itoa(pid), "task", strconv.Itoa(tid))
	t := Task{TID: tid}

	if b, err := os.ReadFile(filepath.Join(base, "comm")); err == nil {
		t.Comm = strings.TrimSpace(string(b))
	}

	statPath := filepath.Join(base, "stat")
	raw, err := os.ReadFile(statPath)
	if err != nil {
		return t, err
	}
	state, procCPU, err := parseStatThread(string(raw))
	if err != nil {
		return t, err
	}
	t.State = state
	t.Processor = procCPU

	if f, err := os.Open(filepath.Join(base, "status")); err == nil {
		sc := bufio.NewScanner(f)
		for sc.Scan() {
			line := sc.Text()
			key, val, ok := strings.Cut(line, ":")
			if !ok {
				continue
			}
			key = strings.TrimSpace(key)
			val = strings.TrimSpace(val)
			switch key {
			case "voluntary_ctxt_switches":
				t.VoluntaryCtxt, _ = strconv.ParseInt(val, 10, 64)
			case "nonvoluntary_ctxt_switches":
				t.NonvoluntaryCtxt, _ = strconv.ParseInt(val, 10, 64)
			case "State":
				// Prefer full status state string if present (e.g. "S (sleeping)")
				if t.State == "" || len(val) > 1 {
					t.State = val
				}
			}
		}
		f.Close()
	}
	return t, nil
}

// parseStatThread extracts state and processor from /proc/.../stat.
// Format: pid (comm) state ... processor is field 39 (1-based).
func parseStatThread(raw string) (state string, processor int, err error) {
	raw = strings.TrimSpace(raw)
	rparen := strings.LastIndex(raw, ")")
	if rparen < 0 || rparen+2 >= len(raw) {
		return "", 0, fmt.Errorf("bad stat: %q", raw)
	}
	rest := strings.Fields(raw[rparen+2:])
	if len(rest) < 37 {
		return "", 0, fmt.Errorf("stat too short: %d fields", len(rest))
	}
	state = rest[0]
	processor, _ = strconv.Atoi(rest[36]) // field 39
	return state, processor, nil
}

// ReadThreadSnapshot samples OS threads; appMetrics are optional values reported by the experiment.
func ReadThreadSnapshot(pid int, phase string, goroutines, gomaxprocs, numCPU int) (ThreadSnapshot, error) {
	st, err := ReadStatus(pid)
	if err != nil {
		return ThreadSnapshot{}, err
	}
	tasks, err := ReadTasks(pid)
	if err != nil {
		return ThreadSnapshot{}, err
	}
	return ThreadSnapshot{
		PID:             pid,
		Phase:           phase,
		ThreadsReported: st.Threads,
		Tasks:           tasks,
		GoroutinesApp:   goroutines,
		GOMAXPROCS:      gomaxprocs,
		NumCPU:          numCPU,
		Note:            "OS threads come from /proc/<pid>/task (REAL). Goroutine counts are from the Go runtime inside the experiment (REAL app metric) — the kernel does not know about goroutines.",
	}, nil
}

// ParseStatThreadText is for unit tests.
func ParseStatThreadText(raw string) (state string, processor int, err error) {
	return parseStatThread(raw)
}
