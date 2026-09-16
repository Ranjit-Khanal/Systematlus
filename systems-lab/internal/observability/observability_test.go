package observability

import (
	"testing"
	"time"

	"github.com/hecker/systematlus/systems-lab/internal/events"
	"github.com/hecker/systematlus/systems-lab/internal/network"
)

func TestSummarizeEvents(t *testing.T) {
	evts := []events.Event{
		{Source: events.SourceReal, Kind: events.KindProcess, Experiment: "processes", TS: time.Now()},
		{Source: events.SourceSimulation, Kind: events.KindMapPulse, Experiment: "processes", TS: time.Now()},
		{Source: events.SourceReal, Kind: events.KindHTTP, Experiment: "http", TS: time.Now()},
	}
	s := SummarizeEvents(evts)
	if s.Total != 3 {
		t.Fatalf("total=%d", s.Total)
	}
	if s.BySource["REAL"] != 2 || s.BySource["SIMULATION"] != 1 {
		t.Fatalf("by_source=%v", s.BySource)
	}
	if s.ByExperiment["http"] != 1 || s.LastExperiment != "http" {
		t.Fatalf("experiment=%v last=%q", s.ByExperiment, s.LastExperiment)
	}
}

func TestSummarizeTCP(t *testing.T) {
	st := SummarizeTCP([]network.Socket{
		{State: "ESTAB"}, {State: "ESTAB"}, {State: "LISTEN"},
	})
	if st.Total != 3 || st.ByState["ESTAB"] != 2 || st.ByState["LISTEN"] != 1 {
		t.Fatalf("tcp=%v", st)
	}
}

func TestCollect(t *testing.T) {
	s := Collect(nil)
	if s.Source != "REAL" {
		t.Fatalf("source=%s", s.Source)
	}
	if s.CollectedAt == "" {
		t.Fatal("missing collected_at")
	}
	if s.ToolsTotal == 0 {
		t.Fatal("expected tools")
	}
}
