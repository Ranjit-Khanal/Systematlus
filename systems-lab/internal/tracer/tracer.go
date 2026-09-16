package tracer

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/hecker/systematlus/systems-lab/internal/events"
)

// SyscallEvent is one parsed strace line (REAL measurement).
type SyscallEvent struct {
	PID      int
	TS       time.Time
	RelNS    int64
	Name     string
	Args     string
	Result   string
	Errno    string
	Duration time.Duration // from -T if present
	Raw      string
}

// line patterns for: strace -f -tt -T
var (
	reSyscall = regexp.MustCompile(`^(\d+)\s+(\d{2}:\d{2}:\d{2}\.\d+)\s+(\w+)\((.*)\)\s*=\s*(.+?)(?:\s+<([0-9.]+)>)?\s*$`)
	reResumed = regexp.MustCompile(`^(\d+)\s+(\d{2}:\d{2}:\d{2}\.\d+)\s+<\.\.\. (\w+) resumed>(.*)?\s*=\s*(.+?)(?:\s+<([0-9.]+)>)?\s*$`)
	reSignal  = regexp.MustCompile(`^(\d+)\s+(\d{2}:\d{2}:\d{2}\.\d+)\s+--- (.+) ---$`)
	reExit    = regexp.MustCompile(`^(\d+)\s+(\d{2}:\d{2}:\d{2}\.\d+)\s+\+\+\+ exited with (\d+) \+\+\+$`)
)

// ParseLine parses a single strace -f -tt -T output line.
func ParseLine(line string, day time.Time) (SyscallEvent, bool) {
	line = strings.TrimSpace(line)
	if line == "" {
		return SyscallEvent{}, false
	}

	if m := reExit.FindStringSubmatch(line); m != nil {
		pid, _ := strconv.Atoi(m[1])
		return SyscallEvent{
			PID: pid, TS: parseClock(day, m[2]), Name: "exit", Result: m[3], Raw: line,
		}, true
	}
	if m := reSignal.FindStringSubmatch(line); m != nil {
		pid, _ := strconv.Atoi(m[1])
		return SyscallEvent{
			PID: pid, TS: parseClock(day, m[2]), Name: "signal", Args: m[3], Raw: line,
		}, true
	}
	if m := reSyscall.FindStringSubmatch(line); m != nil {
		pid, _ := strconv.Atoi(m[1])
		res, errno := splitResult(m[5])
		return SyscallEvent{
			PID: pid, TS: parseClock(day, m[2]), Name: m[3], Args: m[4],
			Result: res, Errno: errno, Duration: parseDur(m[6]), Raw: line,
		}, true
	}
	if m := reResumed.FindStringSubmatch(line); m != nil {
		pid, _ := strconv.Atoi(m[1])
		res, errno := splitResult(m[5])
		return SyscallEvent{
			PID: pid, TS: parseClock(day, m[2]), Name: m[3], Args: strings.TrimSpace(m[4]),
			Result: res, Errno: errno, Duration: parseDur(m[6]), Raw: line,
		}, true
	}
	return SyscallEvent{}, false
}

func parseClock(day time.Time, clock string) time.Time {
	parts := strings.SplitN(clock, ".", 2)
	var h, mi, s, us int
	fmt.Sscanf(parts[0], "%d:%d:%d", &h, &mi, &s)
	if len(parts) == 2 {
		frac := parts[1]
		for len(frac) < 6 {
			frac += "0"
		}
		if len(frac) > 6 {
			frac = frac[:6]
		}
		us, _ = strconv.Atoi(frac)
	}
	base := time.Date(day.Year(), day.Month(), day.Day(), h, mi, s, us*1000, time.Local)
	return base.UTC()
}

func parseDur(s string) time.Duration {
	if s == "" {
		return 0
	}
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0
	}
	return time.Duration(f * float64(time.Second))
}

func splitResult(s string) (result, errno string) {
	s = strings.TrimSpace(s)
	if i := strings.Index(s, " "); i >= 0 {
		return s[:i], strings.TrimSpace(s[i+1:])
	}
	return s, ""
}

// ToEvent converts a parsed syscall into a lab Event.
func (s SyscallEvent) ToEvent(experiment string, t0 time.Time) events.Event {
	e := events.New(events.SourceReal, events.KindSyscall, fmt.Sprintf("%s() = %s", s.Name, s.Result))
	e.TS = s.TS
	if !t0.IsZero() {
		e.RelNS = s.TS.Sub(t0).Nanoseconds()
	}
	e.Experiment = experiment
	e.Layer = "syscall"
	e.PID = s.PID
	e.TID = s.PID
	e.ExplainKey = "syscall." + s.Name
	e.Detail = map[string]any{
		"syscall":     s.Name,
		"args":        s.Args,
		"result":      s.Result,
		"errno":       s.Errno,
		"duration_ns": s.Duration.Nanoseconds(),
		"raw":         s.Raw,
	}
	if s.Errno != "" {
		e.Summary = fmt.Sprintf("%s() = %s %s", s.Name, s.Result, s.Errno)
	}
	return e
}

// Interesting filters runtime noise for the learning timeline.
func Interesting(name string) bool {
	switch name {
	case "open", "openat", "read", "write", "close", "mmap", "munmap", "brk",
		"clone", "clone3", "fork", "vfork", "execve", "execveat",
		"newfstatat", "fstat", "stat", "lseek", "pread64", "pwrite64",
		"socket", "connect", "accept", "accept4", "sendto", "recvfrom",
		"exit", "exit_group", "signal":
		return true
	default:
		return false
	}
}

// RunStrace traces cmdPath with strace -f -tt -T via a FIFO and streams parsed lines.
func RunStrace(cmdPath string, args []string, onEvent func(SyscallEvent)) error {
	if _, err := exec.LookPath("strace"); err != nil {
		return fmt.Errorf("strace unavailable: install with `sudo apt install strace`")
	}

	dir, err := os.MkdirTemp("", "syslab-strace-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(dir)

	fifo := filepath.Join(dir, "trace.fifo")
	if err := syscall.Mkfifo(fifo, 0o600); err != nil {
		return err
	}

	day := time.Now()
	readErr := make(chan error, 1)
	go func() {
		f, err := os.OpenFile(fifo, os.O_RDONLY, 0)
		if err != nil {
			readErr <- err
			return
		}
		defer f.Close()
		sc := bufio.NewScanner(f)
		sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)
		for sc.Scan() {
			ev, ok := ParseLine(sc.Text(), day)
			if ok {
				onEvent(ev)
			}
		}
		if err := sc.Err(); err != nil && err != io.EOF {
			readErr <- err
			return
		}
		readErr <- nil
	}()

	straceArgs := append([]string{"-f", "-tt", "-T", "-o", fifo, "--", cmdPath}, args...)
	cmd := exec.Command("strace", straceArgs...)
	cmd.Stdout = nil
	cmd.Stderr = nil
	if err := cmd.Start(); err != nil {
		return err
	}
	runErr := cmd.Wait()
	scanErr := <-readErr

	if runErr != nil {
		if _, ok := runErr.(*exec.ExitError); !ok {
			return runErr
		}
	}
	return scanErr
}
