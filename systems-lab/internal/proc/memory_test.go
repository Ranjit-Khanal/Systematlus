package proc_test

import (
	"os"
	"testing"

	"github.com/hecker/systematlus/systems-lab/internal/proc"
)

func TestParseSmapsRollupText(t *testing.T) {
	sample := `Rss:                2232 kB
Pss:                 190 kB
Anonymous:           132 kB
Shared_Clean:       2056 kB
Private_Dirty:       132 kB
Swap:                  0 kB
`
	r := proc.ParseSmapsRollupText(sample)
	if r.Rss != 2232 || r.Pss != 190 || r.Anonymous != 132 {
		t.Fatalf("%+v", r)
	}
}

func TestReadSmapsRollupSelf(t *testing.T) {
	r, err := proc.ReadSmapsRollup(os.Getpid())
	if err != nil {
		t.Fatal(err)
	}
	if r.Rss < 1 {
		t.Fatalf("rss=%d", r.Rss)
	}
}

func TestReadMemorySnapshotSelf(t *testing.T) {
	snap, err := proc.ReadMemorySnapshot(os.Getpid(), "test", 40)
	if err != nil {
		t.Fatal(err)
	}
	if snap.PageSize != 4096 && snap.PageSize != 65536 {
		t.Fatalf("unexpected page size %d", snap.PageSize)
	}
	if len(snap.ByKind) == 0 {
		t.Fatal("expected kind summary")
	}
	if snap.Status.VmRSS < 1 {
		t.Fatal("empty VmRSS")
	}
}

func TestSummarizeMapsByKind(t *testing.T) {
	regions := []proc.MapRegion{
		{Start: "1000", End: "2000", Kind: "heap"},   // 4KB
		{Start: "3000", End: "5000", Kind: "anon"},   // 8KB
		{Start: "6000", End: "7000", Kind: "stack"},  // 4KB
	}
	sum := proc.SummarizeMapsByKind(regions)
	got := map[string]int64{}
	for _, k := range sum {
		got[k.Kind] = k.VirtualKB
	}
	if got["heap"] != 4 || got["anon"] != 8 || got["stack"] != 4 {
		t.Fatalf("%+v", sum)
	}
}
