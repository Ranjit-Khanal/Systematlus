package network

import "testing"

func TestParseTcpdumpLineSYN(t *testing.T) {
	line := "12:34:56.789012 IP 127.0.0.1.54321 > 127.0.0.1.8080: Flags [S], seq 1, win 65535, length 0"
	p, ok := ParseTcpdumpLine(line)
	if !ok {
		t.Fatal("expected parse ok")
	}
	if p.Flags != "S" {
		t.Fatalf("flags=%q", p.Flags)
	}
	if p.Src != "127.0.0.1.54321" || p.Dst != "127.0.0.1.8080" {
		t.Fatalf("src/dst=%s/%s", p.Src, p.Dst)
	}
	if p.Proto != "TCP" {
		t.Fatalf("proto=%s", p.Proto)
	}
	if p.Length != 0 {
		t.Fatalf("length=%d", p.Length)
	}
}

func TestParseTcpdumpLinePSH(t *testing.T) {
	line := "01:02:03.000001 IP 127.0.0.1.9 > 127.0.0.1.10: Flags [P.], seq 1:6, ack 1, win 512, length 5"
	p, ok := ParseTcpdumpLine(line)
	if !ok {
		t.Fatal("expected parse ok")
	}
	if p.Flags != "P." {
		t.Fatalf("flags=%q", p.Flags)
	}
	if p.Length != 5 {
		t.Fatalf("length=%d", p.Length)
	}
}

func TestParseTcpdumpLineIgnoresNoise(t *testing.T) {
	if _, ok := ParseTcpdumpLine("tcpdump: listening on lo"); ok {
		t.Fatal("should ignore banner")
	}
	if _, ok := ParseTcpdumpLine(""); ok {
		t.Fatal("should ignore empty")
	}
}

func TestProbeCapture(t *testing.T) {
	c := ProbeCapture()
	// On this lab host tcpdump is usually present but permission-blocked.
	if !c.Present {
		t.Skip("tcpdump not installed")
	}
	if c.Usable && c.BlockedReason != "" {
		t.Fatal("usable but blocked_reason set")
	}
	if !c.Usable && c.InstallHint == "" {
		t.Fatal("blocked capture should include install hint")
	}
}

func TestSimulatedHandshakePackets(t *testing.T) {
	steps := SimulatedHandshakePackets(8080)
	if len(steps) < 3 {
		t.Fatal("expected handshake steps")
	}
}
