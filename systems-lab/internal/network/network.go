package network

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Interface is a host NIC summary from `ip -j addr` (REAL).
type Interface struct {
	Name      string   `json:"name"`
	OperState string   `json:"operstate"`
	MTU       int      `json:"mtu"`
	MAC       string   `json:"mac,omitempty"`
	Addrs     []string `json:"addrs"`
	Flags     []string `json:"flags,omitempty"`
}

// Route is one row from `ip -j route` (REAL).
type Route struct {
	Dst     string `json:"dst"`
	Gateway string `json:"gateway,omitempty"`
	Dev     string `json:"dev,omitempty"`
	Protocol string `json:"protocol,omitempty"`
	Metric  int    `json:"metric,omitempty"`
	PrefSrc string `json:"prefsrc,omitempty"`
}

// Socket is one TCP socket from `ss` (REAL).
type Socket struct {
	State      string `json:"state"`
	RecvQ      int    `json:"recv_q"`
	SendQ      int    `json:"send_q"`
	LocalAddr  string `json:"local_addr"`
	LocalPort  int    `json:"local_port"`
	PeerAddr   string `json:"peer_addr"`
	PeerPort   int    `json:"peer_port"`
	Process    string `json:"process,omitempty"`
	PID        int    `json:"pid,omitempty"`
	Raw        string `json:"raw,omitempty"`
}

// PingResult is from `ping` (REAL when available).
type PingResult struct {
	Target   string  `json:"target"`
	OK       bool    `json:"ok"`
	LatencyMS float64 `json:"latency_ms,omitempty"`
	Detail   string  `json:"detail"`
}

// HostSnapshot is interfaces + routes.
type HostSnapshot struct {
	Interfaces []Interface `json:"interfaces"`
	Routes     []Route     `json:"routes"`
	DefaultDev string      `json:"default_dev,omitempty"`
	Source     string      `json:"source"`
	Note       string      `json:"note"`
}

// Snapshot bundles host + sockets for a lab phase.
type Snapshot struct {
	Phase   string       `json:"phase,omitempty"`
	Host    HostSnapshot `json:"host"`
	Sockets []Socket     `json:"sockets"`
	Ping    *PingResult  `json:"ping,omitempty"`
	Port    int          `json:"port,omitempty"`
	Note    string       `json:"note"`
}

type ipAddrJSON struct {
	IfName    string   `json:"ifname"`
	OperState string   `json:"operstate"`
	MTU       int      `json:"mtu"`
	Address   string   `json:"address"`
	Flags     []string `json:"flags"`
	AddrInfo  []struct {
		Local     string `json:"local"`
		PrefixLen int    `json:"prefixlen"`
		Family    string `json:"family"`
	} `json:"addr_info"`
}

type ipRouteJSON struct {
	Dst      string `json:"dst"`
	Gateway  string `json:"gateway"`
	Dev      string `json:"dev"`
	Protocol string `json:"protocol"`
	Metric   int    `json:"metric"`
	PrefSrc  string `json:"prefsrc"`
}

// ReadHost runs `ip -j addr` and `ip -j route`.
func ReadHost() (HostSnapshot, error) {
	hs := HostSnapshot{Source: "REAL", Note: "From ip -j addr / ip -j route"}
	if _, err := exec.LookPath("ip"); err != nil {
		return hs, fmt.Errorf("ip unavailable: install iproute2")
	}

	out, err := exec.Command("ip", "-j", "addr").Output()
	if err != nil {
		return hs, fmt.Errorf("ip -j addr: %w", err)
	}
	var addrs []ipAddrJSON
	if err := json.Unmarshal(out, &addrs); err != nil {
		return hs, err
	}
	for _, a := range addrs {
		iface := Interface{
			Name: a.IfName, OperState: a.OperState, MTU: a.MTU, MAC: a.Address, Flags: a.Flags,
		}
		for _, ai := range a.AddrInfo {
			if ai.Local == "" {
				continue
			}
			iface.Addrs = append(iface.Addrs, fmt.Sprintf("%s/%d", ai.Local, ai.PrefixLen))
		}
		hs.Interfaces = append(hs.Interfaces, iface)
	}

	out, err = exec.Command("ip", "-j", "route").Output()
	if err != nil {
		return hs, fmt.Errorf("ip -j route: %w", err)
	}
	var routes []ipRouteJSON
	if err := json.Unmarshal(out, &routes); err != nil {
		return hs, err
	}
	for _, r := range routes {
		dst := r.Dst
		if dst == "" {
			dst = "default"
		}
		hs.Routes = append(hs.Routes, Route{
			Dst: dst, Gateway: r.Gateway, Dev: r.Dev, Protocol: r.Protocol, Metric: r.Metric, PrefSrc: r.PrefSrc,
		})
		if dst == "default" && hs.DefaultDev == "" {
			hs.DefaultDev = r.Dev
		}
	}
	return hs, nil
}

// ListTCPByPort runs `ss -H -tanp` and filters sockets involving port.
func ListTCPByPort(port int) ([]Socket, error) {
	if _, err := exec.LookPath("ss"); err != nil {
		return nil, fmt.Errorf("ss unavailable: install iproute2")
	}
	// -t TCP, -a all, -n numeric, -p processes, -H no header
	out, err := exec.Command("ss", "-H", "-tanp").Output()
	if err != nil {
		return nil, fmt.Errorf("ss: %w", err)
	}
	var socks []Socket
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		s, ok := ParseSSLine(line)
		if !ok {
			continue
		}
		if port > 0 && s.LocalPort != port && s.PeerPort != port {
			continue
		}
		socks = append(socks, s)
	}
	return socks, nil
}

var (
	reProc = regexp.MustCompile(`users:\(\("([^"]+)",pid=(\d+)`)
)

// ParseSSLine parses one `ss -H -tanp` line.
func ParseSSLine(line string) (Socket, bool) {
	// State Recv-Q Send-Q Local Peer [users:...]
	fields := strings.Fields(line)
	if len(fields) < 5 {
		return Socket{}, false
	}
	s := Socket{
		State: fields[0],
		Raw:   line,
	}
	s.RecvQ, _ = strconv.Atoi(fields[1])
	s.SendQ, _ = strconv.Atoi(fields[2])
	la, lp, ok1 := splitHostPort(fields[3])
	pa, pp, ok2 := splitHostPort(fields[4])
	if !ok1 || !ok2 {
		return Socket{}, false
	}
	s.LocalAddr, s.LocalPort = la, lp
	s.PeerAddr, s.PeerPort = pa, pp
	if m := reProc.FindStringSubmatch(line); m != nil {
		s.Process = m[1]
		s.PID, _ = strconv.Atoi(m[2])
	}
	return s, true
}

func splitHostPort(s string) (host string, port int, ok bool) {
	// ss uses *:5432, 127.0.0.1:80, [::1]:80, [::]:*
	if strings.HasPrefix(s, "[") {
		end := strings.LastIndex(s, "]")
		if end < 0 {
			return "", 0, false
		}
		host = s[1:end]
		rest := s[end+1:]
		if strings.HasPrefix(rest, ":") {
			rest = rest[1:]
		}
		if rest == "*" {
			return host, 0, true
		}
		p, err := strconv.Atoi(rest)
		if err != nil {
			return "", 0, false
		}
		return host, p, true
	}
	i := strings.LastIndex(s, ":")
	if i < 0 {
		return "", 0, false
	}
	host = s[:i]
	ps := s[i+1:]
	if ps == "*" {
		return host, 0, true
	}
	p, err := strconv.Atoi(ps)
	if err != nil {
		return "", 0, false
	}
	return host, p, true
}

// Ping runs `ping -c 1 -W 1` when available.
func Ping(target string) PingResult {
	r := PingResult{Target: target}
	if _, err := exec.LookPath("ping"); err != nil {
		r.Detail = "ping unavailable"
		return r
	}
	cmd := exec.Command("ping", "-c", "1", "-W", "1", target)
	var buf bytes.Buffer
	cmd.Stdout = &buf
	cmd.Stderr = &buf
	err := cmd.Run()
	out := buf.String()
	r.Detail = strings.TrimSpace(out)
	if len(r.Detail) > 400 {
		r.Detail = r.Detail[:400] + "…"
	}
	if err != nil {
		return r
	}
	r.OK = true
	// time=0.047 ms
	if i := strings.Index(out, "time="); i >= 0 {
		var ms float64
		fmt.Sscanf(out[i:], "time=%f", &ms)
		r.LatencyMS = ms
	}
	return r
}

// SnapshotPort gathers host + sockets for port (+ optional loopback ping).
func SnapshotPort(phase string, port int, withPing bool) (Snapshot, error) {
	host, err := ReadHost()
	if err != nil {
		return Snapshot{}, err
	}
	socks, err := ListTCPByPort(port)
	if err != nil {
		return Snapshot{}, err
	}
	snap := Snapshot{
		Phase:   phase,
		Host:    host,
		Sockets: socks,
		Port:    port,
		Note:    "Socket rows from ss; addresses/routes from ip. Packet bytes require tcpdump (often needs CAP_NET_RAW).",
	}
	if withPing {
		p := Ping("127.0.0.1")
		snap.Ping = &p
	}
	return snap, nil
}

// WaitListening polls until a LISTEN socket appears on port or timeout.
func WaitListening(port int, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		socks, err := ListTCPByPort(port)
		if err == nil {
			for _, s := range socks {
				if s.State == "LISTEN" && s.LocalPort == port {
					return nil
				}
			}
		}
		time.Sleep(30 * time.Millisecond)
	}
	return fmt.Errorf("timeout waiting for LISTEN on :%d", port)
}

// FreePort finds an available TCP port on 127.0.0.1.
func FreePort() (int, error) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, err
	}
	defer ln.Close()
	return ln.Addr().(*net.TCPAddr).Port, nil
}
