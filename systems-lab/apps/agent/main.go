package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"

	"github.com/hecker/systematlus/systems-lab/internal/events"
	"github.com/hecker/systematlus/systems-lab/internal/hub"
	"github.com/hecker/systematlus/systems-lab/internal/network"
	"github.com/hecker/systematlus/systems-lab/internal/observability"
	"github.com/hecker/systematlus/systems-lab/internal/proc"
	"github.com/hecker/systematlus/systems-lab/internal/tools"
	"github.com/hecker/systematlus/systems-lab/internal/tracer"
)

type server struct {
	hub        *hub.Hub
	binDir     string
	mu         sync.Mutex
	running    bool
	corsOrigin string
}

func main() {
	addr := env("SYSLAB_ADDR", ":8080")
	binDir := env("SYSLAB_BIN", filepath.Join(".", "bin"))
	s := &server{
		hub:        hub.New(2000),
		binDir:     binDir,
		corsOrigin: env("SYSLAB_CORS", "http://localhost:5174"),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.handleHealth)
	mux.HandleFunc("GET /api/tools", s.handleTools)
	mux.HandleFunc("GET /api/host", s.handleHost)
	mux.HandleFunc("GET /api/proc/{pid}", s.handleProc)
	mux.HandleFunc("GET /api/events/recent", s.handleRecent)
	mux.HandleFunc("POST /api/events/clear", s.handleClear)
	mux.HandleFunc("POST /api/experiments/process/run", s.handleProcessRun)
	mux.HandleFunc("POST /api/experiments/syscalls/run", s.handleSyscallsRun)
	mux.HandleFunc("POST /api/experiments/memory/run", s.handleMemoryRun)
	mux.HandleFunc("POST /api/experiments/scheduler/run", s.handleSchedulerRun)
	mux.HandleFunc("POST /api/experiments/network/run", s.handleNetworkRun)
	mux.HandleFunc("POST /api/experiments/tcp/run", s.handleTCPRun)
	mux.HandleFunc("POST /api/experiments/dns/run", s.handleDNSRun)
	mux.HandleFunc("POST /api/experiments/http/run", s.handleHTTPRun)
	mux.HandleFunc("POST /api/experiments/database/run", s.handleDatabaseRun)
	mux.HandleFunc("POST /api/experiments/packets/run", s.handlePacketsRun)
	mux.HandleFunc("POST /api/experiments/failures/run", s.handleFailuresRun)
	mux.HandleFunc("POST /api/experiments/load/run", s.handleLoadRun)
	mux.HandleFunc("POST /api/experiments/e2e/run", s.handleE2ERun)
	mux.HandleFunc("GET /api/observability", s.handleObservability)
	mux.HandleFunc("POST /api/observability/refresh", s.handleObservabilityRefresh)
	mux.HandleFunc("GET /api/network", s.handleNetworkHost)
	mux.HandleFunc("GET /api/proc/{pid}/tasks", s.handleProcTasks)
	mux.HandleFunc("GET /api/ws", s.handleWS)

	handler := withCORS(s.corsOrigin, mux)
	log.Printf("systems-lab agent listening on %s (bins=%s)", addr, binDir)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatal(err)
	}
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func withCORS(origin string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *server) publish(e events.Event) {
	s.hub.Publish(e)
}

func (s *server) pulse(layer, summary string) {
	e := events.New(events.SourceSimulation, events.KindMapPulse, summary)
	e.Layer = layer
	e.Detail = map[string]any{
		"note": "UI animation cue only — not a kernel measurement",
	}
	s.publish(e)
}

func (s *server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, map[string]any{"ok": true, "service": "systems-lab-agent"})
}

func (s *server) handleTools(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, map[string]any{"tools": tools.Probe(), "source": "REAL"})
}

func (s *server) handleHost(w http.ResponseWriter, _ *http.Request) {
	h, err := proc.ReadHost()
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	writeJSON(w, map[string]any{"host": h, "source": "REAL"})
}

func (s *server) handleProc(w http.ResponseWriter, r *http.Request) {
	pid, err := strconv.Atoi(r.PathValue("pid"))
	if err != nil || pid <= 0 {
		http.Error(w, "bad pid", 400)
		return
	}
	snap, err := proc.SnapshotPID(pid, true)
	if err != nil {
		http.Error(w, err.Error(), 404)
		return
	}
	writeJSON(w, map[string]any{"snapshot": snap, "source": "REAL"})
}

func (s *server) handleRecent(w http.ResponseWriter, r *http.Request) {
	n := 200
	if v := r.URL.Query().Get("n"); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil {
			n = parsed
		}
	}
	writeJSON(w, map[string]any{"events": s.hub.Recent(n)})
}

func (s *server) handleClear(w http.ResponseWriter, _ *http.Request) {
	s.hub.Clear()
	writeJSON(w, map[string]any{"cleared": true})
}

func (s *server) handleWS(w http.ResponseWriter, r *http.Request) {
	c, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: []string{"localhost:*", "127.0.0.1:*"},
	})
	if err != nil {
		return
	}
	defer c.CloseNow()

	ctx := r.Context()
	ch, unsub := s.hub.Subscribe(128)
	defer unsub()

	for {
		select {
		case <-ctx.Done():
			return
		case e, ok := <-ch:
			if !ok {
				return
			}
			wctx, cancel := context.WithTimeout(ctx, 5*time.Second)
			err := wsjson.Write(wctx, c, e)
			cancel()
			if err != nil {
				return
			}
		}
	}
}

func (s *server) tryLock() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.running {
		return false
	}
	s.running = true
	return true
}

func (s *server) unlock() {
	s.mu.Lock()
	s.running = false
	s.mu.Unlock()
}

func (s *server) handleProcessRun(w http.ResponseWriter, r *http.Request) {
	if !s.tryLock() {
		http.Error(w, "experiment already running", 409)
		return
	}
	defer s.unlock()

	bin := filepath.Join(s.binDir, "exp-processes")
	if _, err := os.Stat(bin); err != nil {
		http.Error(w, "missing experiment binary; run `make build-experiments`", 500)
		return
	}

	s.hub.Clear()
	info := events.New(events.SourceReal, events.KindInfo, "Process experiment started")
	info.Experiment = "processes"
	info.Layer = "application"
	s.publish(info)
	s.pulse("application", "Go process experiment starts")

	cmd := exec.Command(bin)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	parentPID := cmd.Process.Pid

	go s.watchProcessTree(parentPID, "processes")

	waitErr := cmd.Wait()
	if snap, err := proc.SnapshotPID(parentPID, false); err == nil {
		// process may already be gone; ignore
		_ = snap
	}

	done := events.New(events.SourceReal, events.KindProcess, fmt.Sprintf("Parent process exited (pid=%d)", parentPID))
	done.Experiment = "processes"
	done.PID = parentPID
	done.Layer = "process"
	if waitErr != nil {
		done.Detail = map[string]any{"wait_error": waitErr.Error()}
	}
	s.publish(done)
	s.pulse("application", "Experiment finished")

	writeJSON(w, map[string]any{
		"ok":         true,
		"parent_pid": parentPID,
		"note":       "Events streamed on /api/ws; /proc samples are REAL",
	})
}

func (s *server) watchProcessTree(parentPID int, experiment string) {
	deadline := time.Now().Add(3 * time.Second)
	seen := map[int]bool{parentPID: true}

	emitSnap := func(pid int, role string) {
		snap, err := proc.SnapshotPID(pid, false)
		if err != nil {
			return
		}
		e := events.New(events.SourceReal, events.KindProcess,
			fmt.Sprintf("%s pid=%d ppid=%d state=%s rss=%dKB",
				role, snap.Status.PID, snap.Status.PPID, snap.Status.State, snap.Status.VmRSS))
		e.Experiment = experiment
		e.Layer = "process"
		e.PID = snap.Status.PID
		e.PPID = snap.Status.PPID
		e.ExplainKey = "process.lifecycle"
		e.Detail = map[string]any{
			"role":    role,
			"status":  snap.Status,
			"cmdline": snap.Cmdline,
		}
		s.publish(e)
		s.pulse("kernel", fmt.Sprintf("scheduler/process table updated for pid %d", pid))
	}

	emitSnap(parentPID, "parent")
	s.pulse("go_runtime", "os/exec starts child process")
	s.pulse("syscall", "clone/fork + execve (via Go runtime)")

	for time.Now().Before(deadline) {
		// Scan /proc for children of parent
		entries, err := os.ReadDir("/proc")
		if err != nil {
			return
		}
		for _, ent := range entries {
			if !ent.IsDir() {
				continue
			}
			pid, err := strconv.Atoi(ent.Name())
			if err != nil {
				continue
			}
			if seen[pid] {
				continue
			}
			st, err := proc.ReadStatus(pid)
			if err != nil {
				continue
			}
			if st.PPID == parentPID {
				seen[pid] = true
				emitSnap(pid, "child")
				s.pulse("process", fmt.Sprintf("child visible in /proc/%d", pid))
			}
		}
		time.Sleep(50 * time.Millisecond)
	}
}

func (s *server) handleSyscallsRun(w http.ResponseWriter, r *http.Request) {
	if !s.tryLock() {
		http.Error(w, "experiment already running", 409)
		return
	}
	defer s.unlock()

	bin := filepath.Join(s.binDir, "exp-syscalls")
	if _, err := os.Stat(bin); err != nil {
		http.Error(w, "missing experiment binary; run `make build-experiments`", 500)
		return
	}
	if _, err := exec.LookPath("strace"); err != nil {
		http.Error(w, "strace unavailable — install with: sudo apt install strace", 503)
		return
	}

	s.hub.Clear()
	start := events.New(events.SourceReal, events.KindInfo, "Syscall experiment: tracing open/read/write/close under strace")
	start.Experiment = "syscalls"
	start.Layer = "application"
	start.Detail = map[string]any{
		"layers": []string{
			"Go code (os.OpenFile / Read / Write / Close)",
			"Go runtime + syscall package",
			"Linux syscall ABI (openat, read, write, close, …)",
			"Kernel (VFS, page cache, filesystem)",
		},
		"note": "Not every Go function is a syscall — the runtime batches and wraps many operations.",
	}
	s.publish(start)
	s.pulse("application", "Go file I/O program starts")
	s.pulse("go_runtime", "runtime routes to syscall layer")

	var t0 time.Time
	var count int
	err := tracer.RunStrace(bin, nil, func(ev tracer.SyscallEvent) {
		if t0.IsZero() {
			t0 = ev.TS
		}
		if !tracer.Interesting(ev.Name) {
			return
		}
		count++
		e := ev.ToEvent("syscalls", t0)
		s.publish(e)
		switch ev.Name {
		case "open", "openat", "read", "write", "close", "mmap", "brk":
			s.pulse("syscall", ev.Name+"()")
			s.pulse("kernel", "kernel handles "+ev.Name)
		}
	})
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}

	done := events.New(events.SourceReal, events.KindInfo, fmt.Sprintf("Trace complete: %d interesting syscalls published", count))
	done.Experiment = "syscalls"
	done.Layer = "application"
	s.publish(done)

	writeJSON(w, map[string]any{
		"ok":                true,
		"interesting_count": count,
		"source":            "REAL",
		"tool":              "strace -f -tt -T",
	})
}

func (s *server) handleMemoryRun(w http.ResponseWriter, r *http.Request) {
	if !s.tryLock() {
		http.Error(w, "experiment already running", 409)
		return
	}
	defer s.unlock()

	bin := filepath.Join(s.binDir, "exp-memory")
	if _, err := os.Stat(bin); err != nil {
		http.Error(w, "missing experiment binary; run `make build-experiments`", 500)
		return
	}

	s.hub.Clear()
	start := events.New(events.SourceReal, events.KindInfo, "Memory experiment: allocate → touch → hold → release")
	start.Experiment = "memory"
	start.Layer = "application"
	start.Detail = map[string]any{
		"observe": []string{"/proc/<pid>/status", "/proc/<pid>/maps", "/proc/<pid>/smaps_rollup"},
		"note":    "Virtual address ≠ physical address. Touching pages causes page faults that populate RSS.",
	}
	s.publish(start)
	s.pulse("application", "memory experiment starts")
	s.pulse("memory", "watching virtual address space")

	cmd := exec.Command(bin)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	pid := cmd.Process.Pid

	type phaseSnap struct {
		Phase string             `json:"phase"`
		Snap  proc.MemorySnapshot `json:"snapshot"`
	}
	var phases []phaseSnap
	seenPhase := map[string]bool{}

	scan := bufio.NewScanner(stdout)
	for scan.Scan() {
		line := scan.Text()
		if phase, ok := strings.CutPrefix(line, "PHASE="); ok {
			phase = strings.TrimSpace(phase)
			// Sample after the process has entered the phase (it holds for ~900ms).
			time.Sleep(120 * time.Millisecond)
			snap, err := proc.ReadMemorySnapshot(pid, phase, 100)
			if err != nil {
				errEvt := events.New(events.SourceReal, events.KindError, "memory sample failed: "+err.Error())
				errEvt.Experiment = "memory"
				errEvt.PID = pid
				s.publish(errEvt)
				continue
			}
			if seenPhase[phase] {
				continue
			}
			seenPhase[phase] = true
			phases = append(phases, phaseSnap{Phase: phase, Snap: snap})

			e := events.New(events.SourceReal, events.KindMemory,
				fmt.Sprintf("phase=%s VmSize=%dKB VmRSS=%dKB anon=%dKB pss=%dKB",
					phase, snap.Status.VmSize, snap.Status.VmRSS, snap.Rollup.Anonymous, snap.Rollup.Pss))
			e.Experiment = "memory"
			e.Layer = "memory"
			e.PID = pid
			e.ExplainKey = "memory." + phase
			// Keep event payload bounded for the wire; full maps stay in API if needed.
			mapsSample := snap.MapsSample
			if len(mapsSample) > 40 {
				mapsSample = mapsSample[:40]
			}
			detailSnap := snap
			detailSnap.MapsSample = mapsSample
			e.Detail = map[string]any{
				"phase":    phase,
				"snapshot": detailSnap,
			}
			s.publish(e)
			s.pulse("memory", "sampled /proc for phase "+phase)
			s.pulse("kernel", "page tables / mm_struct reflect "+phase)

			if phase == "touch" {
				sim := events.New(events.SourceSimulation, events.KindMemory,
					"[SIMULATION] page fault path: VA → page table → physical frame (not read from pagemap)")
				sim.Experiment = "memory"
				sim.Layer = "memory"
				sim.PID = pid
				sim.ExplainKey = "memory.page_fault"
				sim.Detail = map[string]any{
					"path": []string{
						"virtual address in process",
						"walk page tables (kernel)",
						"allocate/find physical page",
						"update PTE",
						"resume user instruction",
					},
					"note": "This animation is educational. We do not claim to have traced a specific fault from hardware.",
				}
				s.publish(sim)
			}
			continue
		}
		if strings.HasPrefix(line, "ALLOC_") || strings.HasPrefix(line, "TOUCHED_") ||
			strings.HasPrefix(line, "HOLD_") || strings.HasPrefix(line, "RELEASED") ||
			strings.HasPrefix(line, "PID=") || strings.HasPrefix(line, "PAGE_SIZE=") {
			info := events.New(events.SourceReal, events.KindInfo, line)
			info.Experiment = "memory"
			info.Layer = "application"
			info.PID = pid
			s.publish(info)
		}
	}
	_ = cmd.Wait()

	done := events.New(events.SourceReal, events.KindInfo, fmt.Sprintf("Memory experiment finished (%d phase samples)", len(phases)))
	done.Experiment = "memory"
	done.Layer = "application"
	done.PID = pid
	s.publish(done)

	writeJSON(w, map[string]any{
		"ok":     true,
		"pid":    pid,
		"phases": phases,
		"source": "REAL",
		"note":   "RSS rise on touch is from page faults populating anonymous pages — not from make() alone.",
	})
}

func (s *server) handleProcTasks(w http.ResponseWriter, r *http.Request) {
	pid, err := strconv.Atoi(r.PathValue("pid"))
	if err != nil || pid <= 0 {
		http.Error(w, "bad pid", 400)
		return
	}
	snap, err := proc.ReadThreadSnapshot(pid, "", 0, 0, 0)
	if err != nil {
		http.Error(w, err.Error(), 404)
		return
	}
	writeJSON(w, map[string]any{"snapshot": snap, "source": "REAL"})
}

func (s *server) handleSchedulerRun(w http.ResponseWriter, r *http.Request) {
	if !s.tryLock() {
		http.Error(w, "experiment already running", 409)
		return
	}
	defer s.unlock()

	bin := filepath.Join(s.binDir, "exp-scheduler")
	if _, err := os.Stat(bin); err != nil {
		http.Error(w, "missing experiment binary; run `make build-experiments`", 500)
		return
	}

	s.hub.Clear()
	start := events.New(events.SourceReal, events.KindInfo,
		"Scheduler experiment: many goroutines ≠ many OS threads (GOMAXPROCS=2)")
	start.Experiment = "scheduler"
	start.Layer = "go_runtime"
	start.Detail = map[string]any{
		"observe": []string{"/proc/<pid>/task", "/proc/<pid>/status Threads:", "runtime.NumGoroutine()"},
		"note":    "The Linux kernel schedules OS threads. The Go runtime schedules goroutines onto those threads.",
	}
	s.publish(start)
	s.pulse("application", "scheduler experiment starts")
	s.pulse("go_runtime", "Go scheduler multiplexes goroutines")

	cmd := exec.Command(bin)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	pid := cmd.Process.Pid

	goroutines, gomaxprocs, numCPU := 0, 0, 0
	type phaseSnap struct {
		Phase string               `json:"phase"`
		Snap  proc.ThreadSnapshot  `json:"snapshot"`
	}
	var phases []phaseSnap
	seenPhase := map[string]bool{}

	scan := bufio.NewScanner(stdout)
	for scan.Scan() {
		line := scan.Text()
		switch {
		case strings.HasPrefix(line, "GOROUTINES="):
			fmt.Sscanf(line, "GOROUTINES=%d", &goroutines)
		case strings.HasPrefix(line, "GOMAXPROCS="):
			fmt.Sscanf(line, "GOMAXPROCS=%d", &gomaxprocs)
		case strings.HasPrefix(line, "NUM_CPU="):
			fmt.Sscanf(line, "NUM_CPU=%d", &numCPU)
		case strings.HasPrefix(line, "PID="):
			info := events.New(events.SourceReal, events.KindInfo, line)
			info.Experiment = "scheduler"
			info.PID = pid
			s.publish(info)
		}

		phase, ok := strings.CutPrefix(line, "PHASE=")
		if !ok {
			continue
		}
		phase = strings.TrimSpace(phase)
		time.Sleep(150 * time.Millisecond)
		snap, err := proc.ReadThreadSnapshot(pid, phase, goroutines, gomaxprocs, numCPU)
		if err != nil {
			errEvt := events.New(events.SourceReal, events.KindError, "thread sample failed: "+err.Error())
			errEvt.Experiment = "scheduler"
			errEvt.PID = pid
			s.publish(errEvt)
			continue
		}
		if seenPhase[phase] {
			continue
		}
		seenPhase[phase] = true
		phases = append(phases, phaseSnap{Phase: phase, Snap: snap})

		e := events.New(events.SourceReal, events.KindThread,
			fmt.Sprintf("phase=%s goroutines=%d os_threads=%d GOMAXPROCS=%d",
				phase, snap.GoroutinesApp, len(snap.Tasks), snap.GOMAXPROCS))
		e.Experiment = "scheduler"
		e.Layer = "go_runtime"
		e.PID = pid
		e.ExplainKey = "scheduler." + phase
		e.Detail = map[string]any{
			"phase":    phase,
			"snapshot": snap,
		}
		s.publish(e)
		s.pulse("go_runtime", fmt.Sprintf("%d goroutines on %d OS threads", snap.GoroutinesApp, len(snap.Tasks)))
		s.pulse("process", fmt.Sprintf("/proc/%d/task has %d TIDs", pid, len(snap.Tasks)))
		s.pulse("kernel", "CFS schedules OS threads onto CPUs")

		if phase == "many_goroutines" || phase == "cpu_bound" {
			sim := events.New(events.SourceSimulation, events.KindThread,
				"[SIMULATION] Go runtime runqueue → M (OS thread) → CPU (kernel CFS)")
			sim.Experiment = "scheduler"
			sim.Layer = "go_runtime"
			sim.PID = pid
			sim.ExplainKey = "scheduler.gmp"
			sim.Detail = map[string]any{
				"model": []string{
					"G = goroutine (user-space, Go runtime)",
					"M = OS thread (kernel-scheduled entity)",
					"P = logical processor / context (GOMAXPROCS)",
				},
				"note": "GMP diagram is educational. Kernel only sees M (threads).",
			}
			s.publish(sim)
		}
	}
	_ = cmd.Wait()

	done := events.New(events.SourceReal, events.KindInfo,
		fmt.Sprintf("Scheduler experiment finished (%d phase samples)", len(phases)))
	done.Experiment = "scheduler"
	done.Layer = "application"
	done.PID = pid
	s.publish(done)

	writeJSON(w, map[string]any{
		"ok":     true,
		"pid":    pid,
		"phases": phases,
		"source": "REAL",
		"note":   "Compare goroutines (Go runtime) vs len(/proc/pid/task) (OS threads). They are not equal.",
	})
}

func (s *server) handleNetworkHost(w http.ResponseWriter, _ *http.Request) {
	hs, err := network.ReadHost()
	if err != nil {
		http.Error(w, err.Error(), 503)
		return
	}
	writeJSON(w, map[string]any{"host": hs, "source": "REAL"})
}

func (s *server) handleNetworkRun(w http.ResponseWriter, r *http.Request) {
	if !s.tryLock() {
		http.Error(w, "experiment already running", 409)
		return
	}
	defer s.unlock()

	bin := filepath.Join(s.binDir, "exp-networking")
	if _, err := os.Stat(bin); err != nil {
		http.Error(w, "missing experiment binary; run `make build-experiments`", 500)
		return
	}
	if _, err := exec.LookPath("ss"); err != nil {
		http.Error(w, "ss unavailable — install with: sudo apt install iproute2", 503)
		return
	}

	s.hub.Clear()
	start := events.New(events.SourceReal, events.KindInfo,
		"Network experiment: local HTTP server/client on 127.0.0.1 — observe with ss + ip")
	start.Experiment = "network"
	start.Layer = "application"
	start.Detail = map[string]any{
		"observe": []string{"ss -tanp", "ip -j addr", "ip -j route", "ping 127.0.0.1"},
		"note":    "Loopback still uses the full socket → TCP → IP stack; it just never leaves the host.",
	}
	s.publish(start)
	s.pulse("application", "network experiment starts")
	s.pulse("net", "socket / TCP / IP path")

	cmd := exec.Command(bin)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	pid := cmd.Process.Pid
	port := 0

	type phaseSnap struct {
		Phase string            `json:"phase"`
		Snap  network.Snapshot  `json:"snapshot"`
	}
	var phases []phaseSnap
	seenPhase := map[string]bool{}

	scan := bufio.NewScanner(stdout)
	for scan.Scan() {
		line := scan.Text()
		switch {
		case strings.HasPrefix(line, "PORT="):
			fmt.Sscanf(line, "PORT=%d", &port)
			info := events.New(events.SourceReal, events.KindInfo, line)
			info.Experiment = "network"
			info.PID = pid
			s.publish(info)
		case strings.HasPrefix(line, "PID=") || strings.HasPrefix(line, "ADDR=") ||
			strings.HasPrefix(line, "CLIENT_") || strings.HasPrefix(line, "HTTP_"):
			info := events.New(events.SourceReal, events.KindInfo, line)
			info.Experiment = "network"
			info.Layer = "application"
			info.PID = pid
			s.publish(info)
		}

		phase, ok := strings.CutPrefix(line, "PHASE=")
		if !ok {
			continue
		}
		phase = strings.TrimSpace(phase)
		time.Sleep(120 * time.Millisecond)
		if port == 0 {
			continue
		}
		withPing := phase == "listen"
		snap, err := network.SnapshotPort(phase, port, withPing)
		if err != nil {
			errEvt := events.New(events.SourceReal, events.KindError, "network sample failed: "+err.Error())
			errEvt.Experiment = "network"
			errEvt.PID = pid
			s.publish(errEvt)
			continue
		}
		if seenPhase[phase] {
			continue
		}
		seenPhase[phase] = true
		phases = append(phases, phaseSnap{Phase: phase, Snap: snap})

		states := map[string]int{}
		for _, sock := range snap.Sockets {
			states[sock.State]++
		}
		e := events.New(events.SourceReal, events.KindNetwork,
			fmt.Sprintf("phase=%s port=%d sockets=%d states=%v", phase, port, len(snap.Sockets), states))
		e.Experiment = "network"
		e.Layer = "net"
		e.PID = pid
		e.ExplainKey = "network." + phase
		e.Detail = map[string]any{
			"phase":    phase,
			"snapshot": snap,
		}
		s.publish(e)
		s.pulse("net", "ss sampled for :"+strconv.Itoa(port))
		s.pulse("kernel", "TCP stack / socket accounting")

		if phase == "connected" || phase == "http_exchange" {
			sim := events.New(events.SourceSimulation, events.KindNetwork,
				"[SIMULATION] App → socket → TCP → IP → lo (loopback) → peer socket")
			sim.Experiment = "network"
			sim.Layer = "net"
			sim.PID = pid
			sim.ExplainKey = "network.stack"
			sim.Detail = map[string]any{
				"path": []string{
					"Go net/http client",
					"socket (syscall connect/send/recv)",
					"TCP",
					"IP",
					"loopback interface (lo)",
					"TCP",
					"socket",
					"Go net/http server",
				},
				"note": "Path animation is educational. Socket rows and ip data are REAL. No packet capture in this phase.",
			}
			s.publish(sim)
		}
	}
	_ = cmd.Wait()

	done := events.New(events.SourceReal, events.KindInfo,
		fmt.Sprintf("Network experiment finished (%d phase samples, port=%d)", len(phases), port))
	done.Experiment = "network"
	done.Layer = "application"
	done.PID = pid
	s.publish(done)

	writeJSON(w, map[string]any{
		"ok":     true,
		"pid":    pid,
		"port":   port,
		"phases": phases,
		"source": "REAL",
		"note":   "LISTEN → ESTAB (or ESTABLISHED) → closed. traceroute unavailable on this host; ping used on loopback only.",
	})
}

func (s *server) handleTCPRun(w http.ResponseWriter, r *http.Request) {
	if !s.tryLock() {
		http.Error(w, "experiment already running", 409)
		return
	}
	defer s.unlock()

	bin := filepath.Join(s.binDir, "exp-tcp")
	if _, err := os.Stat(bin); err != nil {
		http.Error(w, "missing experiment binary; run `make build-experiments`", 500)
		return
	}
	if _, err := exec.LookPath("ss"); err != nil {
		http.Error(w, "ss unavailable — install with: sudo apt install iproute2", 503)
		return
	}

	s.hub.Clear()
	start := events.New(events.SourceReal, events.KindInfo,
		"TCP experiment: raw socket client/server — ss states + inferred handshake diagram")
	start.Experiment = "tcp"
	start.Layer = "net"
	start.Detail = map[string]any{
		"observe": []string{"ss -tanp during connect/close", "app DATA_SENT/DATA_RECV"},
		"note":    "SYN/SYN-ACK/ACK packet labels are SIMULATION unless ss shows SYN-SENT/SYN-RECV or tcpdump captures packets.",
	}
	s.publish(start)
	s.pulse("net", "TCP connection lifecycle")

	cmd := exec.Command(bin)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	pid := cmd.Process.Pid
	port := 0
	allStates := map[string]bool{}

	type phaseSnap struct {
		Phase string              `json:"phase"`
		Snap  network.TCPSnapshot `json:"snapshot"`
	}
	var phases []phaseSnap
	seenPhase := map[string]bool{}

	emitTCP := func(phase string, socks []network.Socket, states []string, pollNote string) {
		for _, st := range states {
			allStates[st] = true
		}
		for _, sock := range socks {
			allStates[sock.State] = true
		}
		cumStates := make([]string, 0, len(allStates))
		for st := range allStates {
			cumStates = append(cumStates, st)
		}
		cumStates = network.SortStates(cumStates)
		snap := network.TCPSnapshot{
			Phase:      phase,
			Port:       port,
			Sockets:    socks,
			StatesSeen: cumStates,
			ServerPort: port,
			ClientPort: network.EndpointPorts(socks, port),
			Steps:      network.BuildSteps(cumStates, socks, phase),
			Note:       pollNote,
		}
		if seenPhase[phase] {
			return
		}
		seenPhase[phase] = true
		phases = append(phases, phaseSnap{Phase: phase, Snap: snap})

		statesCount := map[string]int{}
		for _, sock := range socks {
			statesCount[sock.State]++
		}
		e := events.New(events.SourceReal, events.KindTCP,
			fmt.Sprintf("phase=%s port=%d states=%v client_port=%d", phase, port, statesCount, snap.ClientPort))
		e.Experiment = "tcp"
		e.Layer = "net"
		e.PID = pid
		e.ExplainKey = "tcp." + phase
		e.Detail = map[string]any{"phase": phase, "snapshot": snap}
		s.publish(e)

		for _, step := range snap.Steps {
			src := events.SourceReal
			if step.Source == "SIMULATION" {
				src = events.SourceSimulation
			}
			if step.Source == "DERIVED" {
				src = events.SourceDerived
			}
			se := events.New(src, events.KindTCP, step.Label)
			se.Experiment = "tcp"
			se.Layer = "net"
			se.PID = pid
			se.ExplainKey = "tcp.step." + step.ID
			se.Detail = map[string]any{"step": step, "phase": phase}
			s.publish(se)
		}
		s.pulse("net", "TCP "+phase)
	}

	scan := bufio.NewScanner(stdout)
	for scan.Scan() {
		line := scan.Text()
		switch {
		case strings.HasPrefix(line, "PORT="):
			fmt.Sscanf(line, "PORT=%d", &port)
			info := events.New(events.SourceReal, events.KindInfo, line)
			info.Experiment = "tcp"
			info.PID = pid
			s.publish(info)
		case strings.HasPrefix(line, "CONNECT_STARTED"):
			if port > 0 {
				socks, states, err := network.PollStates(port, 450*time.Millisecond, 8*time.Millisecond)
				if err == nil {
					emitTCP("handshake_poll", socks, states, "Rapid ss poll during connect (REAL states only)")
				}
			}
		case strings.HasPrefix(line, "CLOSE_STARTED"):
			if port > 0 {
				socks, states, err := network.PollStates(port, 500*time.Millisecond, 8*time.Millisecond)
				if err == nil {
					emitTCP("close_poll", socks, states, "Rapid ss poll during close (REAL teardown states)")
				}
			}
		case strings.HasPrefix(line, "PID=") || strings.HasPrefix(line, "SERVER=") ||
			strings.HasPrefix(line, "CLIENT_") || strings.HasPrefix(line, "DATA_") ||
			strings.HasPrefix(line, "PAYLOAD="):
			info := events.New(events.SourceReal, events.KindInfo, line)
			info.Experiment = "tcp"
			info.Layer = "application"
			info.PID = pid
			s.publish(info)
		}

		phase, ok := strings.CutPrefix(line, "PHASE=")
		if !ok {
			continue
		}
		phase = strings.TrimSpace(phase)
		time.Sleep(100 * time.Millisecond)
		if port == 0 {
			continue
		}
		socks, err := network.ListTCPByPort(port)
		if err != nil {
			errEvt := events.New(events.SourceReal, events.KindError, "tcp sample failed: "+err.Error())
			errEvt.Experiment = "tcp"
			errEvt.PID = pid
			s.publish(errEvt)
			continue
		}
		var states []string
		for _, sock := range socks {
			if !allStates[sock.State] {
				states = append(states, sock.State)
			}
			allStates[sock.State] = true
		}
		states = network.SortStates(states)
		emitTCP(phase, socks, states, "Phase sample from ss")
	}
	_ = cmd.Wait()

	done := events.New(events.SourceReal, events.KindInfo,
		fmt.Sprintf("TCP experiment finished (%d phase samples, port=%d)", len(phases), port))
	done.Experiment = "tcp"
	done.Layer = "application"
	done.PID = pid
	s.publish(done)

	writeJSON(w, map[string]any{
		"ok":     true,
		"pid":    pid,
		"port":   port,
		"phases": phases,
		"source": "REAL",
		"note":   "ss shows LISTEN/ESTAB/teardown states. SYN packet arrows are inferred unless SYN-SENT/SYN-RECV appear in ss.",
	})
}

func (s *server) handleDNSRun(w http.ResponseWriter, r *http.Request) {
	if !s.tryLock() {
		http.Error(w, "experiment already running", 409)
		return
	}
	defer s.unlock()

	domain := strings.TrimSpace(r.URL.Query().Get("domain"))
	if domain == "" {
		domain = "example.com"
	}

	s.hub.Clear()
	start := events.New(events.SourceReal, events.KindInfo, "DNS experiment: resolve "+domain+" via system resolver")
	start.Experiment = "dns"
	start.Layer = "application"
	start.Detail = map[string]any{
		"observe": []string{"/etc/resolv.conf nameservers", "net.Resolver.LookupIP", "optional dig for TTL"},
		"note":    "Caching may make repeat lookups faster — that is REAL resolver behavior.",
	}
	s.publish(start)
	s.pulse("application", "DNS lookup requested")
	s.pulse("net", "resolver → DNS server → IP")

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	res := network.LookupDNS(ctx, domain)

	e := events.New(events.SourceReal, events.KindDNS,
		fmt.Sprintf("domain=%s records=%d latency=%.2fms method=%s", domain, len(res.Records), res.LatencyMS, res.Method))
	e.Experiment = "dns"
	e.Layer = "net"
	e.ExplainKey = "dns.lookup"
	e.Detail = map[string]any{"result": res}
	s.publish(e)

	for _, ns := range res.Nameservers {
		info := events.New(events.SourceReal, events.KindInfo, "nameserver="+ns)
		info.Experiment = "dns"
		info.Layer = "net"
		s.publish(info)
	}
	for _, rec := range res.Records {
		re := events.New(events.SourceReal, events.KindDNS,
			fmt.Sprintf("%s %s %s ttl=%d", rec.Name, rec.Type, rec.Value, rec.TTL))
		re.Experiment = "dns"
		re.Layer = "net"
		re.Detail = map[string]any{"record": rec}
		s.publish(re)
	}

	sim := events.New(events.SourceSimulation, events.KindDNS,
		"[SIMULATION] App → stub resolver → DNS UDP/TCP → answer cached?")
	sim.Experiment = "dns"
	sim.Layer = "net"
	sim.ExplainKey = "dns.path"
	sim.Detail = map[string]any{
		"path": []string{"application", "Go/net resolver", "OS resolver (systemd-resolved)", "DNS server", "IP address"},
		"note": "Path diagram is educational. Records and latency above are REAL.",
	}
	s.publish(sim)

	if res.Error != "" {
		http.Error(w, res.Error, 502)
		return
	}

	writeJSON(w, map[string]any{
		"ok":     true,
		"domain": domain,
		"result": res,
		"source": "REAL",
	})
}

func (s *server) handleHTTPRun(w http.ResponseWriter, r *http.Request) {
	if !s.tryLock() {
		http.Error(w, "experiment already running", 409)
		return
	}
	defer s.unlock()

	bin := filepath.Join(s.binDir, "exp-http")
	if _, err := os.Stat(bin); err != nil {
		http.Error(w, "missing experiment binary; run `make build-experiments`", 500)
		return
	}

	s.hub.Clear()
	start := events.New(events.SourceReal, events.KindInfo, "HTTP experiment: GET /api/users on local net/http server")
	start.Experiment = "http"
	start.Layer = "application"
	start.Detail = map[string]any{
		"stack": []string{"client", "TCP", "net/http server", "ServeMux", "handler", "response"},
	}
	s.publish(start)
	s.pulse("application", "HTTP request starts")

	cmd := exec.Command(bin)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	pid := cmd.Process.Pid
	port := 0
	var timings map[string]float64 = map[string]float64{}
	var status, proto string
	var respBytes int
	headers := map[string]string{}

	scan := bufio.NewScanner(stdout)
	for scan.Scan() {
		line := scan.Text()
		switch {
		case strings.HasPrefix(line, "PORT="):
			fmt.Sscanf(line, "PORT=%d", &port)
		case strings.HasPrefix(line, "URL="):
			info := events.New(events.SourceReal, events.KindInfo, line)
			info.Experiment = "http"
			info.PID = pid
			s.publish(info)
		case strings.HasPrefix(line, "HANDLER_"):
			info := events.New(events.SourceReal, events.KindHTTP, line)
			info.Experiment = "http"
			info.Layer = "application"
			info.PID = pid
			s.publish(info)
			s.pulse("application", "handler executed")
		case strings.HasPrefix(line, "HTTP_STATUS="):
			status = strings.TrimPrefix(line, "HTTP_STATUS=")
		case strings.HasPrefix(line, "HTTP_PROTO="):
			proto = strings.TrimPrefix(line, "HTTP_PROTO=")
		case strings.HasPrefix(line, "RESPONSE_BYTES="):
			fmt.Sscanf(line, "RESPONSE_BYTES=%d", &respBytes)
		case strings.HasPrefix(line, "RESP_HEADER "):
			rest := strings.TrimPrefix(line, "RESP_HEADER ")
			k, v, ok := strings.Cut(rest, "=")
			if ok {
				headers[k] = v
			}
		case strings.HasPrefix(line, "TIMING "):
			rest := strings.TrimPrefix(line, "TIMING ")
			k, v, ok := strings.Cut(rest, "=")
			if ok {
				var ms float64
				fmt.Sscanf(v, "%f", &ms)
				timings[k] = ms
			}
		case strings.HasPrefix(line, "REQUEST_START"):
			s.pulse("net", "TCP connection for HTTP")
		}

		if phase, ok := strings.CutPrefix(line, "PHASE="); ok {
			phase = strings.TrimSpace(phase)
			time.Sleep(80 * time.Millisecond)
			if port > 0 {
				socks, _ := network.ListTCPByPort(port)
				ne := events.New(events.SourceReal, events.KindNetwork,
					fmt.Sprintf("http phase=%s port=%d sockets=%d", phase, port, len(socks)))
				ne.Experiment = "http"
				ne.Layer = "net"
				ne.PID = pid
				ne.Detail = map[string]any{"phase": phase, "sockets": socks}
				s.publish(ne)
			}
			he := events.New(events.SourceReal, events.KindHTTP, "phase="+phase)
			he.Experiment = "http"
			he.Layer = "application"
			he.PID = pid
			s.publish(he)
		}
	}
	_ = cmd.Wait()

	summary := events.New(events.SourceReal, events.KindHTTP,
		fmt.Sprintf("GET /api/users → %s %s %d bytes total=%.2fms", status, proto, respBytes, timings["total_ms"]))
	summary.Experiment = "http"
	summary.Layer = "application"
	summary.PID = pid
	summary.ExplainKey = "http.response"
	summary.Detail = map[string]any{
		"status": status, "proto": proto, "bytes": respBytes,
		"headers": headers, "timing_ms": timings, "port": port,
	}
	s.publish(summary)

	sim := events.New(events.SourceSimulation, events.KindHTTP,
		"[SIMULATION] Browser → TCP → HTTP request line → headers → handler → response")
	sim.Experiment = "http"
	sim.Layer = "application"
	sim.Detail = map[string]any{"note": "Stack diagram only. Status/headers/timing above are REAL from the experiment."}
	s.publish(sim)

	writeJSON(w, map[string]any{
		"ok":      true,
		"pid":     pid,
		"port":    port,
		"status":  status,
		"timings": timings,
		"headers": headers,
		"bytes":   respBytes,
		"source":  "REAL",
	})
}

func (s *server) handleDatabaseRun(w http.ResponseWriter, r *http.Request) {
	if !s.tryLock() {
		http.Error(w, "experiment already running", 409)
		return
	}
	defer s.unlock()

	bin := filepath.Join(s.binDir, "exp-database")
	if _, err := os.Stat(bin); err != nil {
		http.Error(w, "missing experiment binary; run `make build-experiments`", 500)
		return
	}

	s.hub.Clear()
	start := events.New(events.SourceReal, events.KindInfo, "Database experiment: GET /api/users backed by SQLite")
	start.Experiment = "database"
	start.Layer = "application"
	start.Detail = map[string]any{
		"stack": []string{"client", "HTTP handler", "database/sql", "SQLite", "VFS (.db file)"},
	}
	s.publish(start)
	s.pulse("application", "HTTP handler calls database/sql")

	cmd := exec.Command(bin)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	pid := cmd.Process.Pid
	port := 0
	var dbPath, dbDriver string
	var dbFileBytes int
	var timings map[string]float64 = map[string]float64{}
	var status, proto string
	var respBytes int
	var queries []map[string]any
	var pool map[string]int
	var handlerDBMs float64

	scan := bufio.NewScanner(stdout)
	for scan.Scan() {
		line := scan.Text()
		switch {
		case strings.HasPrefix(line, "DB_PATH="):
			dbPath = strings.TrimPrefix(line, "DB_PATH=")
		case strings.HasPrefix(line, "DB_DRIVER="):
			dbDriver = strings.TrimPrefix(line, "DB_DRIVER=")
		case strings.HasPrefix(line, "DB_FILE_BYTES="):
			fmt.Sscanf(line, "DB_FILE_BYTES=%d", &dbFileBytes)
		case strings.HasPrefix(line, "PORT="):
			fmt.Sscanf(line, "PORT=%d", &port)
		case strings.HasPrefix(line, "URL="):
			info := events.New(events.SourceReal, events.KindInfo, line)
			info.Experiment = "database"
			info.PID = pid
			s.publish(info)
		case strings.HasPrefix(line, "DB_EXEC "):
			de := events.New(events.SourceReal, events.KindDatabase, line)
			de.Experiment = "database"
			de.Layer = "vfs"
			de.PID = pid
			de.ExplainKey = "db.exec"
			s.publish(de)
			s.pulse("vfs", "SQLite schema/write")
		case strings.HasPrefix(line, "DB_QUERY "):
			de := events.New(events.SourceReal, events.KindDatabase, line)
			de.Experiment = "database"
			de.Layer = "vfs"
			de.PID = pid
			de.ExplainKey = "db.query"
			s.publish(de)
			s.pulse("vfs", "SQLite SELECT")
			var dur float64
			var rows int
			fmt.Sscanf(line, "DB_QUERY sql=SELECT id,name FROM users ORDER BY id duration_ms=%f rows=%d", &dur, &rows)
			queries = append(queries, map[string]any{
				"sql": "SELECT id, name FROM users ORDER BY id", "duration_ms": dur, "rows": rows,
			})
		case strings.HasPrefix(line, "DB_POOL "):
			de := events.New(events.SourceReal, events.KindDatabase, line)
			de.Experiment = "database"
			de.Layer = "application"
			de.PID = pid
			s.publish(de)
			var open, inUse, idle, maxOpen int
			fmt.Sscanf(line, "DB_POOL open=%d in_use=%d idle=%d max_open=%d", &open, &inUse, &idle, &maxOpen)
			pool = map[string]int{"open": open, "in_use": inUse, "idle": idle, "max_open": maxOpen}
		case strings.HasPrefix(line, "HANDLER_"):
			info := events.New(events.SourceReal, events.KindDatabase, line)
			info.Experiment = "database"
			info.Layer = "application"
			info.PID = pid
			s.publish(info)
			if strings.HasPrefix(line, "HANDLER_DONE ") {
				fmt.Sscanf(line, "HANDLER_DONE duration_ms=%*f db_ms=%f", &handlerDBMs)
			}
		case strings.HasPrefix(line, "HTTP_STATUS="):
			status = strings.TrimPrefix(line, "HTTP_STATUS=")
		case strings.HasPrefix(line, "HTTP_PROTO="):
			proto = strings.TrimPrefix(line, "HTTP_PROTO=")
		case strings.HasPrefix(line, "RESPONSE_BYTES="):
			fmt.Sscanf(line, "RESPONSE_BYTES=%d", &respBytes)
		case strings.HasPrefix(line, "TIMING "):
			rest := strings.TrimPrefix(line, "TIMING ")
			k, v, ok := strings.Cut(rest, "=")
			if ok {
				var ms float64
				fmt.Sscanf(v, "%f", &ms)
				timings[k] = ms
			}
		case strings.HasPrefix(line, "REQUEST_START"):
			s.pulse("net", "TCP connection for HTTP+DB request")
		}

		if phase, ok := strings.CutPrefix(line, "PHASE="); ok {
			phase = strings.TrimSpace(phase)
			time.Sleep(80 * time.Millisecond)
			if port > 0 {
				socks, _ := network.ListTCPByPort(port)
				ne := events.New(events.SourceReal, events.KindNetwork,
					fmt.Sprintf("database phase=%s port=%d sockets=%d", phase, port, len(socks)))
				ne.Experiment = "database"
				ne.Layer = "net"
				ne.PID = pid
				ne.Detail = map[string]any{"phase": phase, "sockets": socks}
				s.publish(ne)
			}
			de := events.New(events.SourceReal, events.KindDatabase, "phase="+phase)
			de.Experiment = "database"
			de.Layer = "application"
			de.PID = pid
			de.Detail = map[string]any{"phase": phase}
			s.publish(de)
		}
	}
	_ = cmd.Wait()

	summary := events.New(events.SourceReal, events.KindDatabase,
		fmt.Sprintf("GET /api/users → SQLite query %.2fms, HTTP %s %d bytes", handlerDBMs, status, respBytes))
	summary.Experiment = "database"
	summary.Layer = "application"
	summary.PID = pid
	summary.ExplainKey = "db.response"
	summary.Detail = map[string]any{
		"driver": dbDriver, "path": dbPath, "file_bytes": dbFileBytes,
		"status": status, "proto": proto, "bytes": respBytes,
		"timing_ms": timings, "queries": queries, "pool": pool,
		"handler_db_ms": handlerDBMs, "port": port,
	}
	s.publish(summary)

	sim := events.New(events.SourceSimulation, events.KindDatabase,
		"[SIMULATION] HTTP handler → database/sql → SQLite driver → VFS read/write .db file")
	sim.Experiment = "database"
	sim.Layer = "vfs"
	sim.Detail = map[string]any{"note": "Stack diagram only. Query timings and pool stats above are REAL from the experiment."}
	s.publish(sim)

	writeJSON(w, map[string]any{
		"ok":       true,
		"pid":      pid,
		"port":     port,
		"driver":   dbDriver,
		"path":     dbPath,
		"queries":  queries,
		"pool":     pool,
		"timings":  timings,
		"status":   status,
		"bytes":    respBytes,
		"source":   "REAL",
	})
}

func (s *server) handlePacketsRun(w http.ResponseWriter, r *http.Request) {
	if !s.tryLock() {
		http.Error(w, "experiment already running", 409)
		return
	}
	defer s.unlock()

	bin := filepath.Join(s.binDir, "exp-tcp")
	if _, err := os.Stat(bin); err != nil {
		http.Error(w, "missing experiment binary; run `make build-experiments`", 500)
		return
	}

	s.hub.Clear()
	cap := network.ProbeCapture()
	capEvt := events.New(events.SourceReal, events.KindPacket,
		fmt.Sprintf("tcpdump present=%v usable=%v — %s", cap.Present, cap.Usable, cap.Detail))
	capEvt.Experiment = "packets"
	capEvt.Layer = "net"
	capEvt.ExplainKey = "packet.capability"
	capEvt.Detail = map[string]any{
		"present": cap.Present, "usable": cap.Usable, "path": cap.Path,
		"detail": cap.Detail, "install_hint": cap.InstallHint, "blocked_reason": cap.BlockedReason,
	}
	s.publish(capEvt)

	start := events.New(events.SourceReal, events.KindInfo,
		"Packets experiment: TCP exchange on loopback; capture if CAP_NET_RAW allows")
	start.Experiment = "packets"
	start.Layer = "net"
	s.publish(start)
	s.pulse("net", "packet capture attempt")

	cmd := exec.Command(bin)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	pid := cmd.Process.Pid
	port := 0
	var packets []network.PacketLine
	mode := "blocked"
	var captureCancel context.CancelFunc
	var captureCmd *exec.Cmd
	var captureLines <-chan string
	captureStarted := false

	drainCapture := func() {
		if captureLines == nil {
			return
		}
		for line := range captureLines {
			p, ok := network.ParseTcpdumpLine(line)
			if !ok {
				continue
			}
			packets = append(packets, p)
			pe := events.New(events.SourceReal, events.KindPacket, p.Summary)
			pe.Experiment = "packets"
			pe.Layer = "net"
			pe.PID = pid
			pe.ExplainKey = "packet.line"
			pe.Detail = map[string]any{
				"raw": p.Raw, "src": p.Src, "dst": p.Dst,
				"flags": p.Flags, "length": p.Length, "proto": p.Proto,
			}
			s.publish(pe)
			s.pulse("net", "captured packet")
		}
	}

	scan := bufio.NewScanner(stdout)
	for scan.Scan() {
		line := scan.Text()
		switch {
		case strings.HasPrefix(line, "PORT="):
			fmt.Sscanf(line, "PORT=%d", &port)
			if cap.Usable && port > 0 && !captureStarted {
				ctx, cancel := context.WithCancel(context.Background())
				captureCancel = cancel
				cCmd, lines, cerr := network.StartCapture(ctx, port)
				if cerr != nil {
					errEvt := events.New(events.SourceReal, events.KindError,
						"tcpdump start failed: "+cerr.Error())
					errEvt.Experiment = "packets"
					errEvt.Detail = map[string]any{"error": cerr.Error()}
					s.publish(errEvt)
				} else {
					captureCmd = cCmd
					captureLines = lines
					captureStarted = true
					mode = "capture"
					info := events.New(events.SourceReal, events.KindPacket,
						fmt.Sprintf("tcpdump capturing lo filter=tcp port %d", port))
					info.Experiment = "packets"
					info.Layer = "net"
					info.PID = pid
					s.publish(info)
				}
			}
		case strings.HasPrefix(line, "CONNECT_STARTED"),
			strings.HasPrefix(line, "CLIENT_"),
			strings.HasPrefix(line, "SERVER_"),
			strings.HasPrefix(line, "PING"),
			strings.HasPrefix(line, "PONG"),
			strings.HasPrefix(line, "CLOSE"):
			info := events.New(events.SourceReal, events.KindTCP, line)
			info.Experiment = "packets"
			info.Layer = "net"
			info.PID = pid
			s.publish(info)
		}

		if phase, ok := strings.CutPrefix(line, "PHASE="); ok {
			phase = strings.TrimSpace(phase)
			time.Sleep(80 * time.Millisecond)
			if port > 0 {
				socks, _ := network.ListTCPByPort(port)
				ne := events.New(events.SourceReal, events.KindNetwork,
					fmt.Sprintf("packets phase=%s port=%d sockets=%d", phase, port, len(socks)))
				ne.Experiment = "packets"
				ne.Layer = "net"
				ne.PID = pid
				ne.Detail = map[string]any{"phase": phase, "sockets": socks}
				s.publish(ne)
			}
		}
	}
	_ = cmd.Wait()

	if captureCancel != nil {
		time.Sleep(200 * time.Millisecond)
		captureCancel()
		if captureCmd != nil {
			_ = captureCmd.Wait()
		}
		drainCapture()
	}

	if captureStarted {
		summary := events.New(events.SourceReal, events.KindPacket,
			fmt.Sprintf("captured %d packets on lo port %d via tcpdump", len(packets), port))
		summary.Experiment = "packets"
		summary.Layer = "net"
		summary.PID = pid
		summary.ExplainKey = "packet.summary"
		summary.Detail = map[string]any{
			"mode": "capture", "port": port, "count": len(packets), "packets": packets,
			"capability": cap,
		}
		s.publish(summary)
		mode = "capture"
	} else {
		// Honest fallback: traffic ran (ss REAL), packets not captured.
		blocked := events.New(events.SourceReal, events.KindPacket,
			"packet capture BLOCKED — tcpdump needs CAP_NET_RAW or root; no packet bytes invented")
		blocked.Experiment = "packets"
		blocked.Layer = "net"
		blocked.PID = pid
		blocked.ExplainKey = "packet.blocked"
		blocked.Detail = map[string]any{
			"mode": "blocked", "port": port, "capability": cap,
			"install_hint": cap.InstallHint,
			"note":         "TCP exchange still ran; socket states from ss are REAL. Packet flags below are SIMULATION only.",
		}
		s.publish(blocked)

		simSteps := network.SimulatedHandshakePackets(port)
		sim := events.New(events.SourceSimulation, events.KindPacket,
			"[SIMULATION] Educational TCP packet sequence (not from tcpdump)")
		sim.Experiment = "packets"
		sim.Layer = "net"
		sim.ExplainKey = "packet.simulation"
		sim.Detail = map[string]any{
			"steps": simSteps,
			"note":  "Shown only because capture is blocked. These are not measured frames.",
		}
		s.publish(sim)
		mode = "blocked"
	}

	writeJSON(w, map[string]any{
		"ok":         true,
		"pid":        pid,
		"port":       port,
		"mode":       mode,
		"packet_n":   len(packets),
		"packets":    packets,
		"capability": cap,
		"source":     "REAL",
	})
}

func (s *server) handleFailuresRun(w http.ResponseWriter, r *http.Request) {
	if !s.tryLock() {
		http.Error(w, "experiment already running", 409)
		return
	}
	defer s.unlock()

	bin := filepath.Join(s.binDir, "exp-failures")
	if _, err := os.Stat(bin); err != nil {
		http.Error(w, "missing experiment binary; run `make build-experiments`", 500)
		return
	}

	s.hub.Clear()
	start := events.New(events.SourceReal, events.KindInfo,
		"Failures experiment: controlled HTTP faults (ok, timeout, 500, slow, connection refused)")
	start.Experiment = "failures"
	start.Layer = "application"
	start.Detail = map[string]any{
		"faults": []string{"ok", "timeout", "500", "slow", "refused"},
	}
	s.publish(start)
	s.pulse("application", "injecting controlled faults")

	cmd := exec.Command(bin)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	pid := cmd.Process.Pid
	port := 0
	type faultRow struct {
		Fault      string  `json:"fault"`
		Outcome    string  `json:"outcome"`
		Status     int     `json:"status,omitempty"`
		DurationMS float64 `json:"duration_ms"`
		Err        string  `json:"err,omitempty"`
	}
	var results []faultRow

	scan := bufio.NewScanner(stdout)
	for scan.Scan() {
		line := scan.Text()
		switch {
		case strings.HasPrefix(line, "PORT="):
			fmt.Sscanf(line, "PORT=%d", &port)
		case strings.HasPrefix(line, "URL="):
			info := events.New(events.SourceReal, events.KindInfo, line)
			info.Experiment = "failures"
			info.PID = pid
			s.publish(info)
		case strings.HasPrefix(line, "FAULT_INJECT "):
			fe := events.New(events.SourceReal, events.KindFailure, line)
			fe.Experiment = "failures"
			fe.Layer = "application"
			fe.PID = pid
			fe.ExplainKey = "failure.inject"
			s.publish(fe)
			s.pulse("application", "fault injected")
		case strings.HasPrefix(line, "FAULT_RESULT "):
			fe := events.New(events.SourceReal, events.KindFailure, line)
			fe.Experiment = "failures"
			fe.Layer = "application"
			fe.PID = pid
			fe.ExplainKey = "failure.result"
			s.publish(fe)
			row := faultRow{}
			// FAULT_RESULT fault=X outcome=Y ...
			parts := strings.Fields(strings.TrimPrefix(line, "FAULT_RESULT "))
			for _, p := range parts {
				k, v, ok := strings.Cut(p, "=")
				if !ok {
					continue
				}
				switch k {
				case "fault":
					row.Fault = v
				case "outcome":
					row.Outcome = v
				case "status":
					fmt.Sscanf(v, "%d", &row.Status)
				case "duration_ms":
					fmt.Sscanf(v, "%f", &row.DurationMS)
				case "err":
					row.Err = strings.TrimPrefix(strings.TrimPrefix(line, "FAULT_RESULT "), "")
					// re-parse err as remainder after err=
					if i := strings.Index(line, "err="); i >= 0 {
						row.Err = line[i+4:]
					}
				}
			}
			results = append(results, row)
			s.pulse("net", "client observed fault outcome")
		case strings.HasPrefix(line, "HANDLER_"):
			he := events.New(events.SourceReal, events.KindFailure, line)
			he.Experiment = "failures"
			he.Layer = "application"
			he.PID = pid
			s.publish(he)
		}

		if phase, ok := strings.CutPrefix(line, "PHASE="); ok {
			phase = strings.TrimSpace(phase)
			time.Sleep(50 * time.Millisecond)
			if port > 0 && phase != "refused" && phase != "done" {
				socks, _ := network.ListTCPByPort(port)
				ne := events.New(events.SourceReal, events.KindNetwork,
					fmt.Sprintf("failures phase=%s port=%d sockets=%d", phase, port, len(socks)))
				ne.Experiment = "failures"
				ne.Layer = "net"
				ne.PID = pid
				ne.Detail = map[string]any{"phase": phase, "sockets": socks}
				s.publish(ne)
			}
			pe := events.New(events.SourceReal, events.KindFailure, "phase="+phase)
			pe.Experiment = "failures"
			pe.Layer = "application"
			pe.PID = pid
			pe.Detail = map[string]any{"phase": phase}
			s.publish(pe)
		}
	}
	_ = cmd.Wait()

	summary := events.New(events.SourceReal, events.KindFailure,
		fmt.Sprintf("fault matrix complete — %d outcomes measured", len(results)))
	summary.Experiment = "failures"
	summary.Layer = "application"
	summary.PID = pid
	summary.ExplainKey = "failure.summary"
	summary.Detail = map[string]any{"results": results, "port": port}
	s.publish(summary)

	sim := events.New(events.SourceSimulation, events.KindFailure,
		"[SIMULATION] Client → timeout/5xx/refused are distinct failure classes")
	sim.Experiment = "failures"
	sim.Layer = "application"
	sim.Detail = map[string]any{
		"note": "Diagram only. Each FAULT_RESULT above is REAL from the client.",
		"classes": []string{
			"timeout — client deadline exceeded while handler still running",
			"http_500 — TCP OK, application error status",
			"refused — nothing listening (connection error before HTTP)",
			"slow — success but elevated latency",
		},
	}
	s.publish(sim)

	writeJSON(w, map[string]any{
		"ok":      true,
		"pid":     pid,
		"port":    port,
		"results": results,
		"source":  "REAL",
	})
}

func (s *server) handleLoadRun(w http.ResponseWriter, r *http.Request) {
	if !s.tryLock() {
		http.Error(w, "experiment already running", 409)
		return
	}
	defer s.unlock()

	bin := filepath.Join(s.binDir, "exp-load")
	if _, err := os.Stat(bin); err != nil {
		http.Error(w, "missing experiment binary; run `make build-experiments`", 500)
		return
	}

	s.hub.Clear()
	start := events.New(events.SourceReal, events.KindInfo,
		"Load experiment: concurrent HTTP clients against local handler")
	start.Experiment = "load"
	start.Layer = "application"
	s.publish(start)
	s.pulse("application", "load generator starts")

	cmd := exec.Command(bin)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	pid := cmd.Process.Pid
	port := 0
	var n, concurrency int
	var wallMS, rps float64
	var okN, errN, handled int
	latency := map[string]float64{}
	var peakSockets int

	scan := bufio.NewScanner(stdout)
	for scan.Scan() {
		line := scan.Text()
		switch {
		case strings.HasPrefix(line, "PORT="):
			fmt.Sscanf(line, "PORT=%d", &port)
		case strings.HasPrefix(line, "LOAD_CONFIG "):
			fmt.Sscanf(line, "LOAD_CONFIG n=%d concurrency=%d", &n, &concurrency)
			info := events.New(events.SourceReal, events.KindLoad, line)
			info.Experiment = "load"
			info.Layer = "application"
			info.PID = pid
			info.ExplainKey = "load.config"
			s.publish(info)
		case strings.HasPrefix(line, "LOAD_START"):
			s.pulse("net", "concurrent TCP/HTTP requests")
		case strings.HasPrefix(line, "LOAD_DONE "):
			fmt.Sscanf(line, "LOAD_DONE wall_ms=%f", &wallMS)
		case strings.HasPrefix(line, "LOAD_STATS "):
			fmt.Sscanf(line, "LOAD_STATS ok=%d err=%d handled=%d", &okN, &errN, &handled)
			le := events.New(events.SourceReal, events.KindLoad, line)
			le.Experiment = "load"
			le.Layer = "application"
			le.PID = pid
			s.publish(le)
		case strings.HasPrefix(line, "LOAD_LATENCY "):
			rest := strings.TrimPrefix(line, "LOAD_LATENCY ")
			for _, p := range strings.Fields(rest) {
				k, v, ok := strings.Cut(p, "=")
				if !ok {
					continue
				}
				var f float64
				fmt.Sscanf(v, "%f", &f)
				latency[k] = f
			}
			le := events.New(events.SourceDerived, events.KindLoad, line)
			le.Experiment = "load"
			le.Layer = "application"
			le.PID = pid
			le.ExplainKey = "load.latency"
			le.Detail = map[string]any{"latency_ms": latency}
			s.publish(le)
		case strings.HasPrefix(line, "LOAD_THROUGHPUT "):
			fmt.Sscanf(line, "LOAD_THROUGHPUT rps=%f", &rps)
			le := events.New(events.SourceDerived, events.KindLoad, line)
			le.Experiment = "load"
			le.Layer = "application"
			le.PID = pid
			s.publish(le)
		case strings.HasPrefix(line, "LOAD_SAMPLE "):
			le := events.New(events.SourceReal, events.KindLoad, line)
			le.Experiment = "load"
			le.Layer = "application"
			le.PID = pid
			s.publish(le)
		case strings.HasPrefix(line, "URL="):
			info := events.New(events.SourceReal, events.KindInfo, line)
			info.Experiment = "load"
			info.PID = pid
			s.publish(info)
		}

		if phase, ok := strings.CutPrefix(line, "PHASE="); ok {
			phase = strings.TrimSpace(phase)
			time.Sleep(50 * time.Millisecond)
			if port > 0 {
				socks, _ := network.ListTCPByPort(port)
				if len(socks) > peakSockets {
					peakSockets = len(socks)
				}
				ne := events.New(events.SourceReal, events.KindNetwork,
					fmt.Sprintf("load phase=%s port=%d sockets=%d", phase, port, len(socks)))
				ne.Experiment = "load"
				ne.Layer = "net"
				ne.PID = pid
				ne.Detail = map[string]any{"phase": phase, "sockets": socks}
				s.publish(ne)
			}
		}
	}
	_ = cmd.Wait()

	// Mid-load socket sample is hard after the fact; sample once more if still listening (usually closed).
	summary := events.New(events.SourceReal, events.KindLoad,
		fmt.Sprintf("load complete — ok=%d err=%d p50=%.2fms rps=%.1f", okN, errN, latency["p50_ms"], rps))
	summary.Experiment = "load"
	summary.Layer = "application"
	summary.PID = pid
	summary.ExplainKey = "load.summary"
	summary.Detail = map[string]any{
		"n": n, "concurrency": concurrency, "ok": okN, "err": errN, "handled": handled,
		"wall_ms": wallMS, "rps": rps, "latency_ms": latency, "peak_sockets": peakSockets, "port": port,
	}
	s.publish(summary)

	sim := events.New(events.SourceSimulation, events.KindLoad,
		"[SIMULATION] Concurrency → queueing → latency tail (p95/p99)")
	sim.Experiment = "load"
	sim.Layer = "application"
	sim.Detail = map[string]any{
		"note": "Latency percentiles are DERIVED from REAL per-request timings. Diagram is educational.",
	}
	s.publish(sim)

	writeJSON(w, map[string]any{
		"ok":           true,
		"pid":          pid,
		"port":         port,
		"n":            n,
		"concurrency":  concurrency,
		"stats":        map[string]any{"ok": okN, "err": errN, "handled": handled, "rps": rps, "wall_ms": wallMS},
		"latency_ms":   latency,
		"peak_sockets": peakSockets,
		"source":       "REAL",
	})
}

func (s *server) handleE2ERun(w http.ResponseWriter, r *http.Request) {
	if !s.tryLock() {
		http.Error(w, "experiment already running", 409)
		return
	}
	defer s.unlock()

	bin := filepath.Join(s.binDir, "exp-e2e")
	if _, err := os.Stat(bin); err != nil {
		http.Error(w, "missing experiment binary; run `make build-experiments`", 500)
		return
	}

	s.hub.Clear()
	start := events.New(events.SourceReal, events.KindInfo,
		"E2E request: DNS → TCP → HTTP → SQLite GET /api/users")
	start.Experiment = "e2e"
	start.Layer = "application"
	start.Detail = map[string]any{
		"flow": []string{"dns", "tcp", "http", "database"},
	}
	s.publish(start)
	s.pulse("application", "E2E request begins")

	cmd := exec.Command(bin)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	pid := cmd.Process.Pid
	port := 0
	domain := "localhost"
	var steps []map[string]any
	timings := map[string]float64{}
	var status string
	var summary map[string]any

	layerKind := func(layer string) events.Kind {
		switch layer {
		case "dns":
			return events.KindDNS
		case "tcp":
			return events.KindTCP
		case "http":
			return events.KindHTTP
		case "db":
			return events.KindDatabase
		default:
			return events.KindE2E
		}
	}

	scan := bufio.NewScanner(stdout)
	for scan.Scan() {
		line := scan.Text()
		switch {
		case strings.HasPrefix(line, "DOMAIN="):
			domain = strings.TrimPrefix(line, "DOMAIN=")
		case strings.HasPrefix(line, "PORT="):
			fmt.Sscanf(line, "PORT=%d", &port)
		case strings.HasPrefix(line, "URL="):
			info := events.New(events.SourceReal, events.KindInfo, line)
			info.Experiment = "e2e"
			info.PID = pid
			s.publish(info)
		case strings.HasPrefix(line, "DNS_RESULT "):
			de := events.New(events.SourceReal, events.KindDNS, line)
			de.Experiment = "e2e"
			de.Layer = "net"
			de.PID = pid
			de.ExplainKey = "e2e.dns"
			s.publish(de)
			s.pulse("net", "DNS resolved")
		case strings.HasPrefix(line, "TCP_CONNECT "):
			te := events.New(events.SourceReal, events.KindTCP, line)
			te.Experiment = "e2e"
			te.Layer = "net"
			te.PID = pid
			te.ExplainKey = "e2e.tcp"
			s.publish(te)
			s.pulse("net", "TCP connect")
		case strings.HasPrefix(line, "STEP "):
			rest := strings.TrimPrefix(line, "STEP ")
			step := map[string]any{"raw": line}
			var layer, action string
			var dur float64
			for _, p := range strings.Fields(rest) {
				k, v, ok := strings.Cut(p, "=")
				if !ok {
					continue
				}
				switch k {
				case "layer":
					layer = v
					step["layer"] = v
				case "action":
					action = v
					step["action"] = v
				case "duration_ms":
					fmt.Sscanf(v, "%f", &dur)
					step["duration_ms"] = dur
				default:
					step[k] = v
				}
			}
			steps = append(steps, step)
			se := events.New(events.SourceReal, layerKind(layer),
				fmt.Sprintf("e2e %s.%s %.2fms", layer, action, dur))
			se.Experiment = "e2e"
			se.Layer = layerLayer(layer)
			se.PID = pid
			se.ExplainKey = "e2e.step"
			se.Detail = step
			s.publish(se)
			s.pulse(layerLayer(layer), fmt.Sprintf("%s %s", layer, action))
		case strings.HasPrefix(line, "DB_QUERY "):
			de := events.New(events.SourceReal, events.KindDatabase, line)
			de.Experiment = "e2e"
			de.Layer = "vfs"
			de.PID = pid
			s.publish(de)
			s.pulse("vfs", "SQLite query")
		case strings.HasPrefix(line, "HTTP_STATUS="):
			status = strings.TrimPrefix(line, "HTTP_STATUS=")
		case strings.HasPrefix(line, "TIMING "):
			rest := strings.TrimPrefix(line, "TIMING ")
			for _, p := range strings.Fields(rest) {
				k, v, ok := strings.Cut(p, "=")
				if !ok {
					continue
				}
				var f float64
				fmt.Sscanf(v, "%f", &f)
				timings[k] = f
			}
		case strings.HasPrefix(line, "E2E_SUMMARY "):
			summary = map[string]any{"raw": line}
			for _, p := range strings.Fields(strings.TrimPrefix(line, "E2E_SUMMARY ")) {
				k, v, ok := strings.Cut(p, "=")
				if !ok {
					continue
				}
				if strings.HasSuffix(k, "_ms") {
					var f float64
					fmt.Sscanf(v, "%f", &f)
					summary[k] = f
					timings[k] = f
				} else {
					summary[k] = v
				}
			}
		case strings.HasPrefix(line, "HANDLER_"):
			he := events.New(events.SourceReal, events.KindHTTP, line)
			he.Experiment = "e2e"
			he.Layer = "application"
			he.PID = pid
			s.publish(he)
		}

		if phase, ok := strings.CutPrefix(line, "PHASE="); ok {
			phase = strings.TrimSpace(phase)
			time.Sleep(80 * time.Millisecond)
			if port > 0 && phase != "dns" && phase != "setup" && phase != "done" {
				socks, _ := network.ListTCPByPort(port)
				ne := events.New(events.SourceReal, events.KindNetwork,
					fmt.Sprintf("e2e phase=%s port=%d sockets=%d", phase, port, len(socks)))
				ne.Experiment = "e2e"
				ne.Layer = "net"
				ne.PID = pid
				ne.Detail = map[string]any{"phase": phase, "sockets": socks}
				s.publish(ne)
			}
			pe := events.New(events.SourceReal, events.KindE2E, "phase="+phase)
			pe.Experiment = "e2e"
			pe.Layer = "application"
			pe.PID = pid
			pe.Detail = map[string]any{"phase": phase}
			s.publish(pe)
		}
	}
	_ = cmd.Wait()

	fin := events.New(events.SourceReal, events.KindE2E,
		fmt.Sprintf("E2E complete — %s → HTTP %s total=%.2fms", domain, status, timings["total_ms"]))
	fin.Experiment = "e2e"
	fin.Layer = "application"
	fin.PID = pid
	fin.ExplainKey = "e2e.summary"
	fin.Detail = map[string]any{
		"domain": domain, "port": port, "status": status,
		"steps": steps, "timing_ms": timings, "summary": summary,
	}
	s.publish(fin)

	sim := events.New(events.SourceSimulation, events.KindE2E,
		"[SIMULATION] Browser → DNS → TCP → HTTP → handler → DB → response")
	sim.Experiment = "e2e"
	sim.Layer = "application"
	sim.Detail = map[string]any{
		"note": "Path animation only. Step timings and statuses above are REAL.",
	}
	s.publish(sim)

	writeJSON(w, map[string]any{
		"ok":        true,
		"pid":       pid,
		"domain":    domain,
		"port":      port,
		"status":    status,
		"steps":     steps,
		"timing_ms": timings,
		"summary":   summary,
		"source":    "REAL",
	})
}

func layerLayer(layer string) string {
	switch layer {
	case "dns", "tcp":
		return "net"
	case "db":
		return "vfs"
	case "http":
		return "application"
	default:
		return "application"
	}
}

func (s *server) handleObservability(w http.ResponseWriter, r *http.Request) {
	n := 500
	if v := r.URL.Query().Get("n"); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil && parsed > 0 {
			n = parsed
		}
	}
	snap := observability.Collect(s.hub.Recent(n))
	writeJSON(w, map[string]any{"snapshot": snap, "source": "REAL"})
}

func (s *server) handleObservabilityRefresh(w http.ResponseWriter, r *http.Request) {
	snap := observability.Collect(s.hub.Recent(500))
	oe := events.New(events.SourceReal, events.KindObs,
		fmt.Sprintf("observability snapshot — %d tools usable, %d tcp sockets, %d events in ring",
			snap.ToolsUsable, snap.TCP.Total, snap.Events.Total))
	oe.Experiment = "observability"
	oe.Layer = "application"
	oe.ExplainKey = "obs.snapshot"
	oe.Detail = map[string]any{
		"collected_at": snap.CollectedAt,
		"host":         snap.Host,
		"tools_usable": snap.ToolsUsable,
		"tools_total":  snap.ToolsTotal,
		"tcp_total":    snap.TCP.Total,
		"tcp_by_state": snap.TCP.ByState,
		"events":       snap.Events,
		"capture":      snap.Capture,
		"network_err":  snap.NetworkErr,
		"tcp_err":      snap.TCPErr,
	}
	s.publish(oe)
	s.pulse("application", "observability refresh")
	writeJSON(w, map[string]any{"snapshot": snap, "event_id": oe.ID, "source": "REAL"})
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	_ = enc.Encode(v)
}
