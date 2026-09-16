package tracer

import (
	"testing"
	"time"
)

func TestParseSyscallLine(t *testing.T) {
	day := time.Date(2026, 9, 16, 0, 0, 0, 0, time.Local)
	line := `12345 10:32:04.123456 openat(AT_FDCWD, "/tmp/x", O_RDONLY) = 3 <0.000012>`
	ev, ok := ParseLine(line, day)
	if !ok {
		t.Fatal("parse failed")
	}
	if ev.PID != 12345 || ev.Name != "openat" || ev.Result != "3" {
		t.Fatalf("%+v", ev)
	}
	if ev.Duration != 12*time.Microsecond {
		t.Fatalf("duration=%v", ev.Duration)
	}
	if !Interesting(ev.Name) {
		t.Fatal("openat should be interesting")
	}
}

func TestParseErrno(t *testing.T) {
	day := time.Now()
	line := `99 01:02:03.000001 openat(AT_FDCWD, "nope", O_RDONLY) = -1 ENOENT (No such file or directory) <0.000001>`
	ev, ok := ParseLine(line, day)
	if !ok {
		t.Fatal("parse failed")
	}
	if ev.Result != "-1" || ev.Errno == "" {
		t.Fatalf("%+v", ev)
	}
}

func TestParseExit(t *testing.T) {
	day := time.Now()
	line := `42 12:00:00.000000 +++ exited with 0 +++`
	ev, ok := ParseLine(line, day)
	if !ok || ev.Name != "exit" || ev.Result != "0" {
		t.Fatalf("%+v ok=%v", ev, ok)
	}
}

func TestParseNoiseRejected(t *testing.T) {
	_, ok := ParseLine("garbage", time.Now())
	if ok {
		t.Fatal("expected reject")
	}
}

func TestInterestingFilter(t *testing.T) {
	if Interesting("futex") {
		t.Fatal("futex should be filtered by default")
	}
	if !Interesting("write") {
		t.Fatal("write should pass")
	}
}
