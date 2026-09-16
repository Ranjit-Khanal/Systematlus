package network

import (
	"testing"
)

func TestBuildStepsListenEstab(t *testing.T) {
	socks := []Socket{
		{State: "LISTEN", LocalAddr: "127.0.0.1", LocalPort: 8080},
		{State: "ESTAB", LocalAddr: "127.0.0.1", LocalPort: 8080, PeerAddr: "127.0.0.1", PeerPort: 54321},
	}
	steps := BuildSteps([]string{"LISTEN", "ESTAB"}, socks, "connected")
	if len(steps) < 3 {
		t.Fatalf("expected listen + sim handshake + estab, got %d", len(steps))
	}
	if steps[0].Source != "REAL" || steps[0].SSState != "LISTEN" {
		t.Fatalf("%+v", steps[0])
	}
	foundSim := false
	foundEstab := false
	for _, st := range steps {
		if st.Source == "SIMULATION" && st.ID == "syn" {
			foundSim = true
		}
		if st.SSState == "ESTAB" {
			foundEstab = true
		}
	}
	if !foundSim || !foundEstab {
		t.Fatalf("%+v", steps)
	}
}

func TestBuildStepsSynReal(t *testing.T) {
	socks := []Socket{{State: "SYN-SENT", LocalPort: 1234, PeerPort: 80}}
	steps := BuildSteps([]string{"SYN-SENT"}, socks, "handshake")
	found := false
	for _, st := range steps {
		if st.SSState == "SYN-SENT" && st.Source == "REAL" {
			found = true
		}
	}
	if !found {
		t.Fatalf("%+v", steps)
	}
}

func TestEndpointPorts(t *testing.T) {
	socks := []Socket{
		{State: "ESTAB", LocalAddr: "127.0.0.1", LocalPort: 9000, PeerAddr: "127.0.0.1", PeerPort: 43210},
	}
	if got := EndpointPorts(socks, 9000); got != 43210 {
		t.Fatalf("got %d", got)
	}
}

func TestSortStates(t *testing.T) {
	got := SortStates([]string{"ESTAB", "LISTEN", "TIME-WAIT"})
	if got[0] != "LISTEN" || got[1] != "ESTAB" || got[2] != "TIME-WAIT" {
		t.Fatalf("%v", got)
	}
}
