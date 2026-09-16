package proc_test

import (
	"os"
	"testing"

	"github.com/hecker/systematlus/systems-lab/internal/proc"
)

func TestReadStatusSelf(t *testing.T) {
	pid := os.Getpid()
	st, err := proc.ReadStatus(pid)
	if err != nil {
		t.Fatal(err)
	}
	if st.PID != pid {
		t.Fatalf("pid: got %d want %d", st.PID, pid)
	}
	if st.Name == "" {
		t.Fatal("empty Name")
	}
	if st.State == "" {
		t.Fatal("empty State")
	}
}

func TestReadMapsSelf(t *testing.T) {
	maps, err := proc.ReadMaps(os.Getpid(), 50)
	if err != nil {
		t.Fatal(err)
	}
	if len(maps) == 0 {
		t.Fatal("expected at least one mapping")
	}
	foundFile := false
	for _, m := range maps {
		if m.Kind == "file" || m.Kind == "anon" || m.Kind == "heap" || m.Kind == "stack" {
			foundFile = true
			break
		}
	}
	if !foundFile {
		t.Fatalf("unexpected map kinds: %+v", maps[0])
	}
}

func TestReadHost(t *testing.T) {
	h, err := proc.ReadHost()
	if err != nil {
		t.Fatal(err)
	}
	if h.CPUs < 1 {
		t.Fatalf("cpus=%d", h.CPUs)
	}
	if h.MemTotalKB < 1 {
		t.Fatalf("mem=%d", h.MemTotalKB)
	}
	if h.KernelRelease == "" {
		t.Fatal("empty kernel release")
	}
}

func TestSnapshotPID(t *testing.T) {
	snap, err := proc.SnapshotPID(os.Getpid(), true)
	if err != nil {
		t.Fatal(err)
	}
	if snap.Status.PID != os.Getpid() {
		t.Fatal("bad snapshot pid")
	}
	if len(snap.Files) < 5 {
		t.Fatal("expected /proc file guide")
	}
}
