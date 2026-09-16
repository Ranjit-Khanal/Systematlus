package observability

import (
	"time"

	"github.com/hecker/systematlus/systems-lab/internal/events"
	"github.com/hecker/systematlus/systems-lab/internal/network"
	"github.com/hecker/systematlus/systems-lab/internal/proc"
	"github.com/hecker/systematlus/systems-lab/internal/tools"
)

// EventSummary aggregates the event ring (REAL counts from the hub).
type EventSummary struct {
	Total           int            `json:"total"`
	BySource        map[string]int `json:"by_source"`
	ByKind          map[string]int `json:"by_kind"`
	ByExperiment    map[string]int `json:"by_experiment"`
	LastExperiment  string         `json:"last_experiment,omitempty"`
	LastEventTS     string         `json:"last_event_ts,omitempty"`
	LastEventKind   string         `json:"last_event_kind,omitempty"`
}

// TCPStats summarizes ss output (REAL).
type TCPStats struct {
	Total  int            `json:"total"`
	ByState map[string]int `json:"by_state"`
}

// Snapshot is one observability dashboard sample — all host fields are REAL measurements.
type Snapshot struct {
	CollectedAt string                    `json:"collected_at"`
	Host        proc.HostInfo             `json:"host"`
	Network     network.HostSnapshot      `json:"network"`
	NetworkErr  string                    `json:"network_err,omitempty"`
	TCP         TCPStats                  `json:"tcp"`
	TCPErr      string                    `json:"tcp_err,omitempty"`
	Tools       []tools.Status            `json:"tools"`
	ToolsUsable int                       `json:"tools_usable"`
	ToolsTotal  int                       `json:"tools_total"`
	Capture     network.CaptureCapability `json:"capture"`
	Events      EventSummary              `json:"events"`
	Source      string                    `json:"source"`
}

// SummarizeEvents counts events in the ring buffer.
func SummarizeEvents(evts []events.Event) EventSummary {
	s := EventSummary{
		BySource:     map[string]int{},
		ByKind:       map[string]int{},
		ByExperiment: map[string]int{},
	}
	for _, e := range evts {
		s.Total++
		s.BySource[string(e.Source)]++
		s.ByKind[string(e.Kind)]++
		if e.Experiment != "" {
			s.ByExperiment[e.Experiment]++
			s.LastExperiment = e.Experiment
		}
		s.LastEventTS = e.TS.Format(time.RFC3339Nano)
		s.LastEventKind = string(e.Kind)
	}
	return s
}

// SummarizeTCP counts socket states from ss.
func SummarizeTCP(socks []network.Socket) TCPStats {
	st := TCPStats{ByState: map[string]int{}}
	for _, s := range socks {
		st.Total++
		st.ByState[s.State]++
	}
	return st
}

// Collect gathers host, network, tool, and event-ring snapshots.
func Collect(recent []events.Event) Snapshot {
	now := time.Now().UTC()
	snap := Snapshot{
		CollectedAt: now.Format(time.RFC3339Nano),
		Source:      "REAL",
		Events:      SummarizeEvents(recent),
		Capture:     network.ProbeCapture(),
	}

	if h, err := proc.ReadHost(); err == nil {
		snap.Host = h
	}

	snap.Tools = tools.Probe()
	snap.ToolsTotal = len(snap.Tools)
	for _, t := range snap.Tools {
		if t.Usable {
			snap.ToolsUsable++
		}
	}

	if hs, err := network.ReadHost(); err == nil {
		snap.Network = hs
	} else {
		snap.NetworkErr = err.Error()
	}

	if socks, err := network.ListTCPByPort(0); err == nil {
		snap.TCP = SummarizeTCP(socks)
	} else {
		snap.TCPErr = err.Error()
	}

	return snap
}
