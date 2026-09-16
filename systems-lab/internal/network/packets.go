package network

import (
	"bufio"
	"context"
	"fmt"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// CaptureCapability is a REAL observation about whether packet capture works.
type CaptureCapability struct {
	Present       bool   `json:"present"`
	Usable        bool   `json:"usable"`
	Path          string `json:"path,omitempty"`
	Detail        string `json:"detail"`
	InstallHint   string `json:"install_hint,omitempty"`
	BlockedReason string `json:"blocked_reason,omitempty"`
}

// PacketLine is one decoded tcpdump text line (REAL when captured).
type PacketLine struct {
	Raw       string `json:"raw"`
	Timestamp string `json:"timestamp,omitempty"`
	Src       string `json:"src,omitempty"`
	Dst       string `json:"dst,omitempty"`
	Proto     string `json:"proto,omitempty"`
	Flags     string `json:"flags,omitempty"`
	Length    int    `json:"length,omitempty"`
	Summary   string `json:"summary"`
}

// ProbeCapture tests whether tcpdump can open the loopback interface.
func ProbeCapture() CaptureCapability {
	path, err := exec.LookPath("tcpdump")
	if err != nil {
		return CaptureCapability{
			Present:       false,
			Usable:        false,
			Detail:        "tcpdump not found in PATH",
			InstallHint:   "sudo apt install tcpdump",
			BlockedReason: "missing",
		}
	}
	// -c 0 exits immediately after opening; permission errors surface here.
	cmd := exec.Command("tcpdump", "-i", "lo", "-c", "0", "-n")
	out, err := cmd.CombinedOutput()
	msg := string(out)
	if err != nil || strings.Contains(msg, "Operation not permitted") || strings.Contains(msg, "permission") {
		return CaptureCapability{
			Present:       true,
			Usable:         false,
			Path:          path,
			Detail:        "installed but capture requires CAP_NET_RAW or root",
			InstallHint:   "sudo setcap cap_net_raw,cap_net_admin=eip $(which tcpdump)  OR run agent/tcpdump with sudo",
			BlockedReason: "permission",
		}
	}
	return CaptureCapability{
		Present: true,
		Usable:  true,
		Path:   path,
		Detail: "usable for capture on lo",
	}
}

// tcpdump classic: "12:34:56.789012 IP 127.0.0.1.54321 > 127.0.0.1.8080: Flags [S], seq 1, win 65535, length 0"
var (
	reTCPDump = regexp.MustCompile(`^(\S+)\s+IP\s+(\S+)\s+>\s+(\S+):\s+(.*)$`)
	reFlags   = regexp.MustCompile(`Flags\s+\[([^\]]+)\]`)
	reLength  = regexp.MustCompile(`length\s+(\d+)`)
)

// ParseTcpdumpLine parses one tcpdump -n -tt text line into fields.
func ParseTcpdumpLine(line string) (PacketLine, bool) {
	line = strings.TrimSpace(line)
	if line == "" || strings.HasPrefix(line, "tcpdump:") || strings.HasPrefix(line, "listening on") {
		return PacketLine{}, false
	}
	p := PacketLine{Raw: line, Summary: line, Proto: "IP"}
	m := reTCPDump.FindStringSubmatch(line)
	if m == nil {
		if strings.Contains(line, " > ") {
			p.Summary = line
			return p, true
		}
		return PacketLine{}, false
	}
	p.Timestamp = m[1]
	p.Src = strings.TrimSuffix(m[2], ":")
	p.Dst = strings.TrimSuffix(m[3], ":")
	rest := m[4]
	if fm := reFlags.FindStringSubmatch(rest); fm != nil {
		p.Flags = fm[1]
		p.Proto = "TCP"
	}
	if lm := reLength.FindStringSubmatch(rest); lm != nil {
		p.Length, _ = strconv.Atoi(lm[1])
	}
	if strings.Contains(rest, "UDP") || strings.HasPrefix(rest, "UDP") {
		p.Proto = "UDP"
	}
	p.Summary = fmt.Sprintf("%s %s → %s", p.Proto, p.Src, p.Dst)
	if p.Flags != "" {
		p.Summary += " [" + p.Flags + "]"
	}
	if p.Length > 0 {
		p.Summary += fmt.Sprintf(" len=%d", p.Length)
	}
	return p, true
}

// StartCapture launches tcpdump filtered to a TCP port on lo.
// Caller must cancel the context; lines are written to the returned channel until done.
func StartCapture(ctx context.Context, port int) (*exec.Cmd, <-chan string, error) {
	path, err := exec.LookPath("tcpdump")
	if err != nil {
		return nil, nil, err
	}
	filter := fmt.Sprintf("tcp port %d", port)
	cmd := exec.CommandContext(ctx, path, "-i", "lo", "-n", "-l", "-tt", filter)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, nil, err
	}
	cmd.Stderr = cmd.Stdout
	if err := cmd.Start(); err != nil {
		return nil, nil, err
	}
	ch := make(chan string, 256)
	go func() {
		defer close(ch)
		sc := bufio.NewScanner(stdout)
		for sc.Scan() {
			select {
			case ch <- sc.Text():
			case <-ctx.Done():
				return
			}
		}
	}()
	time.Sleep(150 * time.Millisecond)
	return cmd, ch, nil
}

// SimulatedHandshakePackets returns educational packet steps — always SIMULATION.
func SimulatedHandshakePackets(port int) []map[string]any {
	_ = port
	return []map[string]any{
		{"step": 1, "dir": "→", "flags": "S", "label": "SYN", "note": "client opens connection"},
		{"step": 2, "dir": "←", "flags": "S.", "label": "SYN-ACK", "note": "server acknowledges"},
		{"step": 3, "dir": "→", "flags": ".", "label": "ACK", "note": "handshake complete"},
		{"step": 4, "dir": "→", "flags": "P.", "label": "PSH+ACK", "note": "application data (e.g. PING)"},
		{"step": 5, "dir": "←", "flags": "P.", "label": "PSH+ACK", "note": "application data (e.g. PONG)"},
		{"step": 6, "dir": "→", "flags": "F.", "label": "FIN-ACK", "note": "teardown begins"},
	}
}
