package loadstats

import "testing"

func TestPercentile(t *testing.T) {
	vals := []float64{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	if got := Percentile(vals, 50); got != 5 {
		t.Fatalf("p50=%v", got)
	}
	if got := Percentile(vals, 100); got != 10 {
		t.Fatalf("max=%v", got)
	}
	if got := Percentile(nil, 50); got != 0 {
		t.Fatalf("empty=%v", got)
	}
}

func TestSummarize(t *testing.T) {
	s := Summarize([]float64{10, 20, 30, 40}, 1, 0.5)
	if s["ok"] != 4 || s["err"] != 1 {
		t.Fatalf("counts=%v", s)
	}
	if s["rps"] != 8 {
		t.Fatalf("rps=%v", s["rps"])
	}
	if s["avg_ms"] != 25 {
		t.Fatalf("avg=%v", s["avg_ms"])
	}
}
