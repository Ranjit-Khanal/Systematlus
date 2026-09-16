package network

import (
	"testing"
)

func TestParseSSLineIPv4(t *testing.T) {
	line := `ESTAB 0 0 127.0.0.1:18080 127.0.0.1:54321 users:(("exp-networking",pid=1234,fd=5))`
	s, ok := ParseSSLine(line)
	if !ok {
		t.Fatal("parse failed")
	}
	if s.State != "ESTAB" || s.LocalPort != 18080 || s.PeerPort != 54321 {
		t.Fatalf("%+v", s)
	}
	if s.Process != "exp-networking" || s.PID != 1234 {
		t.Fatalf("%+v", s)
	}
}

func TestParseSSLineListen(t *testing.T) {
	line := `LISTEN 0 4096 127.0.0.1:18080 0.0.0.0:*`
	s, ok := ParseSSLine(line)
	if !ok || s.State != "LISTEN" || s.LocalPort != 18080 || s.PeerPort != 0 {
		t.Fatalf("%+v ok=%v", s, ok)
	}
}

func TestParseSSLineIPv6(t *testing.T) {
	line := `LISTEN 0 4096 [::1]:8080 [::]:*`
	s, ok := ParseSSLine(line)
	if !ok || s.LocalAddr != "::1" || s.LocalPort != 8080 {
		t.Fatalf("%+v ok=%v", s, ok)
	}
}

func TestReadHost(t *testing.T) {
	hs, err := ReadHost()
	if err != nil {
		t.Fatal(err)
	}
	if len(hs.Interfaces) < 1 {
		t.Fatal("no interfaces")
	}
	foundLo := false
	for _, iface := range hs.Interfaces {
		if iface.Name == "lo" {
			foundLo = true
		}
	}
	if !foundLo {
		t.Fatal("missing lo")
	}
}

func TestListTCPByPortListen(t *testing.T) {
	// Port 1 is unlikely to be ours; just ensure ss runs without error.
	_, err := ListTCPByPort(1)
	if err != nil {
		t.Fatal(err)
	}
}
