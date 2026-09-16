package proc

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// Status is a parsed subset of /proc/<pid>/status.
type Status struct {
	Name    string `json:"name"`
	State   string `json:"state"`
	PID     int    `json:"pid"`
	PPID    int    `json:"ppid"`
	TGID    int    `json:"tgid"`
	Threads int    `json:"threads"`
	VmPeak  int64 `json:"vm_peak_kb"`
	VmSize  int64 `json:"vm_size_kb"`
	VmHWM   int64 `json:"vm_hwm_kb"` // peak RSS
	VmRSS   int64 `json:"vm_rss_kb"`
	VmData  int64 `json:"vm_data_kb"`
	VmStack int64 `json:"vm_stack_kb"`
	VmExe   int64 `json:"vm_exe_kb"`
	VoluntaryCtxt    int64 `json:"voluntary_ctxt_switches"`
	NonvoluntaryCtxt int64 `json:"nonvoluntary_ctxt_switches"`
}

// MapRegion is one line from /proc/<pid>/maps (summary fields only).
type MapRegion struct {
	Start   string `json:"start"`
	End     string `json:"end"`
	Perms   string `json:"perms"`
	Offset  string `json:"offset"`
	Path    string `json:"path,omitempty"`
	Kind    string `json:"kind"` // stack, heap, anon, file, vdso, vvar, vsyscall
}

// Snapshot is what the lab exposes for a live process.
type Snapshot struct {
	PID     int         `json:"pid"`
	Cmdline string      `json:"cmdline"`
	Status  Status      `json:"status"`
	Maps    []MapRegion `json:"maps,omitempty"`
	Files   map[string]string `json:"proc_files,omitempty"` // filename → short description / first lines
}

// ReadStatus parses /proc/<pid>/status.
func ReadStatus(pid int) (Status, error) {
	path := filepath.Join("/proc", strconv.Itoa(pid), "status")
	f, err := os.Open(path)
	if err != nil {
		return Status{}, err
	}
	defer f.Close()

	var s Status
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
		case "Name":
			s.Name = val
		case "State":
			s.State = val
		case "Pid":
			s.PID, _ = strconv.Atoi(val)
		case "PPid":
			s.PPID, _ = strconv.Atoi(val)
		case "Tgid":
			s.TGID, _ = strconv.Atoi(val)
		case "Threads":
			s.Threads, _ = strconv.Atoi(val)
		case "VmPeak":
			s.VmPeak = parseKB(val)
		case "VmSize":
			s.VmSize = parseKB(val)
		case "VmHWM":
			s.VmHWM = parseKB(val)
		case "VmRSS":
			s.VmRSS = parseKB(val)
		case "VmData":
			s.VmData = parseKB(val)
		case "VmStk":
			s.VmStack = parseKB(val)
		case "VmExe":
			s.VmExe = parseKB(val)
		case "voluntary_ctxt_switches":
			s.VoluntaryCtxt, _ = strconv.ParseInt(val, 10, 64)
		case "nonvoluntary_ctxt_switches":
			s.NonvoluntaryCtxt, _ = strconv.ParseInt(val, 10, 64)
		}
	}
	return s, sc.Err()
}

func parseKB(val string) int64 {
	fields := strings.Fields(val)
	if len(fields) == 0 {
		return 0
	}
	n, _ := strconv.ParseInt(fields[0], 10, 64)
	return n
}

// ReadCmdline returns the NUL-separated cmdline joined with spaces.
func ReadCmdline(pid int) (string, error) {
	b, err := os.ReadFile(filepath.Join("/proc", strconv.Itoa(pid), "cmdline"))
	if err != nil {
		return "", err
	}
	parts := strings.Split(string(b), "\x00")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p != "" {
			out = append(out, p)
		}
	}
	return strings.Join(out, " "), nil
}

// ReadMaps parses /proc/<pid>/maps into summarized regions.
func ReadMaps(pid int, limit int) ([]MapRegion, error) {
	f, err := os.Open(filepath.Join("/proc", strconv.Itoa(pid), "maps"))
	if err != nil {
		return nil, err
	}
	defer f.Close()
	if limit <= 0 {
		limit = 200
	}
	var regions []MapRegion
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		if len(regions) >= limit {
			break
		}
		r, ok := parseMapsLine(sc.Text())
		if ok {
			regions = append(regions, r)
		}
	}
	return regions, sc.Err()
}

func parseMapsLine(line string) (MapRegion, bool) {
	fields := strings.Fields(line)
	if len(fields) < 5 {
		return MapRegion{}, false
	}
	addr := fields[0]
	start, end, ok := strings.Cut(addr, "-")
	if !ok {
		return MapRegion{}, false
	}
	path := ""
	if len(fields) >= 6 {
		path = strings.Join(fields[5:], " ")
	}
	return MapRegion{
		Start:  start,
		End:    end,
		Perms:  fields[1],
		Offset: fields[2],
		Path:   path,
		Kind:   classifyMap(path),
	}, true
}

func classifyMap(path string) string {
	switch {
	case path == "[heap]":
		return "heap"
	case path == "[stack]" || strings.HasPrefix(path, "[stack:"):
		return "stack"
	case path == "[vdso]":
		return "vdso"
	case path == "[vvar]":
		return "vvar"
	case path == "[vsyscall]":
		return "vsyscall"
	case path == "":
		return "anon"
	default:
		return "file"
	}
}

// SnapshotPID gathers a process view for the UI.
func SnapshotPID(pid int, withMaps bool) (Snapshot, error) {
	st, err := ReadStatus(pid)
	if err != nil {
		return Snapshot{}, err
	}
	cmd, _ := ReadCmdline(pid)
	snap := Snapshot{
		PID:     pid,
		Cmdline: cmd,
		Status:  st,
		Files:   ProcFileGuide(),
	}
	if withMaps {
		maps, err := ReadMaps(pid, 120)
		if err == nil {
			snap.Maps = maps
		}
	}
	return snap, nil
}

// ProcFileGuide explains important /proc/<pid> files (educational text, not measurements).
func ProcFileGuide() map[string]string {
	return map[string]string{
		"status":  "Human-readable process attributes: state, PPID, memory (Vm*), threads, context switches.",
		"cmdline": "Command line arguments (NUL-separated in the file).",
		"environ": "Environment variables at exec time (may be restricted).",
		"maps":    "Virtual memory mappings: address ranges, permissions, backing files.",
		"smaps":   "Per-mapping memory accounting (RSS, PSS, Swap) — more detailed than maps.",
		"smaps_rollup": "Aggregated smaps totals for the whole address space (Rss, Pss, Anonymous, …).",
		"stat":    "Single-line scheduler/accounting fields used by ps(1).",
		"statm":   "Memory sizes in pages (quick summary).",
		"fd/":     "Open file descriptors as symlinks.",
		"task/":   "One directory per OS thread (TID) in the thread group — what the kernel schedules.",
		"cwd":     "Symlink to current working directory.",
		"exe":     "Symlink to the executable being run.",
		"io":      "Bytes read/written (if readable).",
		"comm":    "Short process name (15 chars).",
		"wchan":   "Kernel wait channel when sleeping.",
	}
}

// HostInfo is a REAL snapshot of the machine from /proc.
type HostInfo struct {
	Hostname     string `json:"hostname"`
	KernelRelease string `json:"kernel_release"`
	KernelVersion string `json:"kernel_version"`
	CPUs         int    `json:"cpus"`
	MemTotalKB   int64  `json:"mem_total_kb"`
	MemAvailableKB int64 `json:"mem_available_kb"`
	UptimeSec    float64 `json:"uptime_sec"`
}

func ReadHost() (HostInfo, error) {
	var h HostInfo
	h.Hostname, _ = os.Hostname()
	if b, err := os.ReadFile("/proc/sys/kernel/osrelease"); err == nil {
		h.KernelRelease = strings.TrimSpace(string(b))
	}
	if b, err := os.ReadFile("/proc/version"); err == nil {
		h.KernelVersion = strings.TrimSpace(string(b))
	}
	if b, err := os.ReadFile("/proc/cpuinfo"); err == nil {
		h.CPUs = strings.Count(string(b), "processor")
	}
	if f, err := os.Open("/proc/meminfo"); err == nil {
		sc := bufio.NewScanner(f)
		for sc.Scan() {
			line := sc.Text()
			if strings.HasPrefix(line, "MemTotal:") {
				h.MemTotalKB = parseKB(strings.TrimPrefix(line, "MemTotal:"))
			}
			if strings.HasPrefix(line, "MemAvailable:") {
				h.MemAvailableKB = parseKB(strings.TrimPrefix(line, "MemAvailable:"))
			}
		}
		f.Close()
	}
	if b, err := os.ReadFile("/proc/uptime"); err == nil {
		fmt.Sscanf(string(b), "%f", &h.UptimeSec)
	}
	return h, nil
}
