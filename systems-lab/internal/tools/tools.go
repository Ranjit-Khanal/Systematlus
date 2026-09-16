package tools

import (
	"os"
	"os/exec"
	"strings"
)

// Status describes one host tool for the capability panel.
type Status struct {
	Name      string `json:"name"`
	Present   bool   `json:"present"`
	Path      string `json:"path,omitempty"`
	Usable    bool   `json:"usable"`
	Detail    string `json:"detail"`
	Install   string `json:"install_hint,omitempty"`
	NeededFor string `json:"needed_for,omitempty"`
}

// Probe returns the lab capability matrix (REAL observations about the host).
func Probe() []Status {
	return []Status{
		probePath("go", "Building and running experiment binaries", "sudo apt install golang-go"),
		probeStrace(),
		probePath("ss", "Socket / TCP connection state", "sudo apt install iproute2"),
		probePath("ip", "Interfaces and routes", "sudo apt install iproute2"),
		probePerf(),
		probeTcpdump(),
		probeMissing("tshark", "Packet decode UI (Wireshark CLI)", "sudo apt install tshark"),
		probeMissing("traceroute", "Path MTU / hop observation", "sudo apt install traceroute"),
		probeMissing("bpftrace", "Advanced kernel tracing (later phases)", "sudo apt install bpftrace"),
		probeProc(),
	}
}

func probePath(name, needed, install string) Status {
	path, err := exec.LookPath(name)
	if err != nil {
		return Status{Name: name, Present: false, Usable: false, Detail: "not found in PATH", Install: install, NeededFor: needed}
	}
	return Status{Name: name, Present: true, Path: path, Usable: true, Detail: "available", NeededFor: needed}
}

func probeMissing(name, needed, install string) Status {
	path, err := exec.LookPath(name)
	if err != nil {
		return Status{Name: name, Present: false, Usable: false, Detail: "not installed", Install: install, NeededFor: needed}
	}
	return Status{Name: name, Present: true, Path: path, Usable: true, Detail: "available", NeededFor: needed}
}

func probeStrace() Status {
	s := probePath("strace", "Syscall timeline for experiments", "sudo apt install strace")
	if !s.Present {
		return s
	}
	// Confirm we can at least invoke help.
	out, err := exec.Command("strace", "-V").CombinedOutput()
	if err != nil {
		s.Usable = false
		s.Detail = "present but failed to run: " + err.Error()
		return s
	}
	s.Detail = strings.TrimSpace(string(out))
	if len(s.Detail) > 80 {
		s.Detail = s.Detail[:80] + "…"
	}
	return s
}

func probePerf() Status {
	s := probePath("perf", "Hardware/PMU and some kernel profiling", "sudo apt install linux-tools-generic")
	if !s.Present {
		return s
	}
	paranoid, _ := os.ReadFile("/proc/sys/kernel/perf_event_paranoid")
	level := strings.TrimSpace(string(paranoid))
	// Try a cheap self-check; on this host paranoid=4 blocks users.
	cmd := exec.Command("perf", "stat", "-e", "cycles", "--", "true")
	out, err := cmd.CombinedOutput()
	if err != nil || strings.Contains(string(out), "Access to performance monitoring") || strings.Contains(string(out), "not supported") || strings.Contains(string(out), "No supported events") {
		s.Usable = false
		s.Detail = "installed but blocked for this user (perf_event_paranoid=" + level + "). Needs CAP_PERFMON or lower paranoid."
		s.Install = "Ask admin: set kernel.perf_event_paranoid<=2, or grant CAP_PERFMON to perf"
		return s
	}
	s.Detail = "usable (perf_event_paranoid=" + level + ")"
	return s
}

func probeTcpdump() Status {
	s := probePath("tcpdump", "Packet capture on interfaces", "sudo apt install tcpdump")
	if !s.Present {
		return s
	}
	cmd := exec.Command("tcpdump", "-i", "lo", "-c", "0")
	out, err := cmd.CombinedOutput()
	msg := string(out)
	if err != nil || strings.Contains(msg, "Operation not permitted") || strings.Contains(msg, "permission") {
		s.Usable = false
		s.Detail = "installed but capture requires CAP_NET_RAW or root"
		s.Install = "sudo setcap cap_net_raw,cap_net_admin=eip $(which tcpdump)  OR run with sudo"
		return s
	}
	s.Detail = "usable for capture"
	return s
}

func probeProc() Status {
	_, err := os.ReadFile("/proc/self/status")
	if err != nil {
		return Status{Name: "/proc", Present: false, Usable: false, Detail: err.Error(), NeededFor: "Process inspection"}
	}
	return Status{Name: "/proc", Present: true, Path: "/proc", Usable: true, Detail: "readable for this user", NeededFor: "Process / memory / host metrics"}
}
