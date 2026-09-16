package network

import (
	"fmt"
	"sort"
	"strings"
	"time"
)

// TCPStep is one row in the TCP timeline (REAL from ss or SIMULATION inference).
type TCPStep struct {
	ID          string   `json:"id"`
	Label       string   `json:"label"`
	Source      string   `json:"source"` // REAL | SIMULATION | DERIVED
	SSState     string   `json:"ss_state,omitempty"`
	Sockets     []Socket `json:"sockets,omitempty"`
	Explanation string   `json:"explanation,omitempty"`
}

// TCPSnapshot is a point-in-time view for the TCP lab.
type TCPSnapshot struct {
	Phase       string    `json:"phase"`
	Port        int       `json:"port"`
	Sockets     []Socket  `json:"sockets"`
	StatesSeen  []string  `json:"states_seen,omitempty"`
	ClientPort  int       `json:"client_port,omitempty"`
	ServerPort  int       `json:"server_port,omitempty"`
	Steps       []TCPStep `json:"steps,omitempty"`
	Note        string    `json:"note"`
}

// PollStates samples ss repeatedly and returns newly observed TCP states (REAL).
func PollStates(port int, duration time.Duration, interval time.Duration) ([]Socket, []string, error) {
	deadline := time.Now().Add(duration)
	seen := map[string]bool{}
	var order []string
	var last []Socket
	for time.Now().Before(deadline) {
		socks, err := ListTCPByPort(port)
		if err != nil {
			return nil, nil, err
		}
		last = socks
		for _, s := range socks {
			key := s.State + "|" + s.LocalAddr + ":" + itoa(s.LocalPort) + "->" + s.PeerAddr + ":" + itoa(s.PeerPort)
			if !seen[key] {
				seen[key] = true
				if !contains(order, s.State) {
					order = append(order, s.State)
				}
			}
		}
		time.Sleep(interval)
	}
	return last, order, nil
}

func contains(ss []string, v string) bool {
	for _, s := range ss {
		if s == v {
			return true
		}
	}
	return false
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	return fmt.Sprintf("%d", n)
}

// BuildSteps turns observed ss states + app phase into a teaching timeline.
// SYN/SYN-ACK/ACK packet labels are SIMULATION — loopback handshakes are often too fast for ss to show SYN-SENT.
func BuildSteps(states []string, socks []Socket, phase string) []TCPStep {
	var steps []TCPStep
	stateSet := map[string]bool{}
	for _, st := range states {
		stateSet[st] = true
	}
	for _, s := range socks {
		stateSet[s.State] = true
	}

	if stateSet["LISTEN"] || phase == "listen" {
		steps = append(steps, TCPStep{
			ID: "listen", Label: "LISTEN (server socket open)", Source: "REAL", SSState: "LISTEN",
			Sockets:     filterState(socks, "LISTEN"),
			Explanation: "ss shows the server waiting for connections.",
		})
	}

	if stateSet["SYN-SENT"] || stateSet["SYN-RECV"] {
		if stateSet["SYN-SENT"] {
			steps = append(steps, TCPStep{
				ID: "syn_sent", Label: "SYN-SENT (client side)", Source: "REAL", SSState: "SYN-SENT",
				Sockets: filterState(socks, "SYN-SENT"),
				Explanation: "Client has sent SYN; captured by ss.",
			})
		}
		if stateSet["SYN-RECV"] {
			steps = append(steps, TCPStep{
				ID: "syn_recv", Label: "SYN-RECV (server side)", Source: "REAL", SSState: "SYN-RECV",
				Sockets: filterState(socks, "SYN-RECV"),
				Explanation: "Server received SYN; captured by ss.",
			})
		}
	} else if stateSet["ESTAB"] || phase == "connected" || phase == "data" {
		// Handshake packets not observed — infer educationally when ESTAB appears.
		steps = append(steps, TCPStep{
			ID: "syn", Label: "SYN → SYN-ACK → ACK (three-way handshake)", Source: "SIMULATION",
			Explanation: "Inferred because ss shows ESTAB. Individual SYN packets were not captured (too fast on loopback; use tcpdump for packet-level proof).",
		})
	}

	if stateSet["ESTAB"] {
		steps = append(steps, TCPStep{
			ID: "estab", Label: "ESTABLISHED", Source: "REAL", SSState: "ESTAB",
			Sockets:     filterState(socks, "ESTAB"),
			Explanation: "Connection is open; both sides can send data.",
		})
	}

	for _, st := range []string{"FIN-WAIT-1", "FIN-WAIT-2", "CLOSE-WAIT", "LAST-ACK", "TIME-WAIT", "CLOSING"} {
		if stateSet[st] {
			steps = append(steps, TCPStep{
				ID: strings.ToLower(st), Label: st, Source: "REAL", SSState: st,
				Sockets:     filterState(socks, st),
				Explanation: "Teardown state observed via ss during close.",
			})
		}
	}

	if len(steps) == 0 && len(socks) > 0 {
		steps = append(steps, TCPStep{
			ID: "raw", Label: "ss snapshot", Source: "REAL",
			Sockets: socks,
		})
	}
	return steps
}

func filterState(socks []Socket, state string) []Socket {
	var out []Socket
	for _, s := range socks {
		if s.State == state {
			out = append(out, s)
		}
	}
	return out
}

// EndpointPorts guesses client/server ephemeral ports from ESTAB sockets on serverPort.
func EndpointPorts(socks []Socket, serverPort int) (clientPort int) {
	for _, s := range socks {
		if s.State != "ESTAB" && s.State != "FIN-WAIT-1" && s.State != "FIN-WAIT-2" && s.State != "CLOSE-WAIT" && s.State != "TIME-WAIT" {
			continue
		}
		if s.LocalPort == serverPort && s.PeerPort > 0 {
			return s.PeerPort
		}
		if s.PeerPort == serverPort && s.LocalPort > 0 {
			return s.LocalPort
		}
	}
	return 0
}

// SortStates orders TCP states in lifecycle order for display.
func SortStates(states []string) []string {
	order := map[string]int{
		"LISTEN": 1, "SYN-SENT": 2, "SYN-RECV": 3, "ESTAB": 4,
		"FIN-WAIT-1": 5, "FIN-WAIT-2": 6, "CLOSE-WAIT": 7, "LAST-ACK": 8, "TIME-WAIT": 9, "CLOSING": 10,
	}
	sort.Slice(states, func(i, j int) bool {
		oi, oki := order[states[i]]
		oj, okj := order[states[j]]
		if !oki {
			oi = 99
		}
		if !okj {
			oj = 99
		}
		return oi < oj
	})
	return states
}
