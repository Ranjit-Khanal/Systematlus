package proc_test

import (
	"os"
	"runtime"
	"testing"

	"github.com/hecker/systematlus/systems-lab/internal/proc"
)

func TestParseStatThreadText(t *testing.T) {
	// Synthetic line: fields after ") " must include processor at index 36.
	rest := make([]string, 40)
	rest[0] = "R"
	for i := 1; i < 40; i++ {
		rest[i] = "0"
	}
	rest[36] = "7"
	raw := "1234 (my thread) " + join(rest)
	state, cpu, err := proc.ParseStatThreadText(raw)
	if err != nil {
		t.Fatal(err)
	}
	if state != "R" || cpu != 7 {
		t.Fatalf("state=%s cpu=%d", state, cpu)
	}
}

func join(ss []string) string {
	out := ss[0]
	for i := 1; i < len(ss); i++ {
		out += " " + ss[i]
	}
	return out
}

func TestReadTasksSelf(t *testing.T) {
	pid := os.Getpid()
	tasks, err := proc.ReadTasks(pid)
	if err != nil {
		t.Fatal(err)
	}
	if len(tasks) < 1 {
		t.Fatal("expected at least one task")
	}
	found := false
	for _, task := range tasks {
		if task.TID == pid {
			found = true
			if !task.IsThreadGroupLeader {
				t.Fatal("leader flag")
			}
		}
		if task.State == "" {
			t.Fatalf("empty state for tid %d", task.TID)
		}
	}
	if !found {
		t.Fatal("thread group leader missing")
	}
}

func TestReadThreadSnapshotSelf(t *testing.T) {
	snap, err := proc.ReadThreadSnapshot(os.Getpid(), "test", runtime.NumGoroutine(), runtime.GOMAXPROCS(0), runtime.NumCPU())
	if err != nil {
		t.Fatal(err)
	}
	if snap.ThreadsReported < 1 {
		t.Fatal("threads")
	}
	if len(snap.Tasks) < 1 {
		t.Fatal("tasks")
	}
	if snap.GoroutinesApp < 1 {
		t.Fatal("goroutines")
	}
}
