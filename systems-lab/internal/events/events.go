package events

import (
	"sync/atomic"
	"time"
)

// Source classifies how we know about an event.
type Source string

const (
	SourceReal       Source = "REAL"
	SourceSimulation Source = "SIMULATION"
	SourceDerived    Source = "DERIVED"
)

// Kind is a coarse event category for filtering.
type Kind string

const (
	KindProcess  Kind = "process"
	KindSyscall  Kind = "syscall"
	KindMemory   Kind = "memory"
	KindThread   Kind = "thread"
	KindNetwork  Kind = "network"
	KindTCP      Kind = "tcp"
	KindDNS      Kind = "dns"
	KindHTTP     Kind = "http"
	KindDatabase Kind = "database"
	KindPacket   Kind = "packet"
	KindFailure  Kind = "failure"
	KindLoad     Kind = "load"
	KindObs      Kind = "observability"
	KindE2E      Kind = "e2e"
	KindProc     Kind = "proc"
	KindHost     Kind = "host"
	KindInfo     Kind = "info"
	KindError    Kind = "error"
	KindMapPulse Kind = "map_pulse" // UI animation cue; usually SIMULATION driven by REAL
)

// Event is the single wire format for the lab timeline and WebSocket stream.
type Event struct {
	ID         string         `json:"id"`
	TS         time.Time      `json:"ts"`
	RelNS      int64          `json:"rel_ns,omitempty"`
	Source     Source         `json:"source"`
	Kind       Kind           `json:"kind"`
	Layer      string         `json:"layer,omitempty"`
	Experiment string         `json:"experiment,omitempty"`
	PID        int            `json:"pid,omitempty"`
	TID        int            `json:"tid,omitempty"`
	PPID       int            `json:"ppid,omitempty"`
	Summary    string         `json:"summary"`
	Detail     map[string]any `json:"detail,omitempty"`
	ExplainKey string         `json:"explain_key,omitempty"`
}

var seq atomic.Uint64

// New builds an event with a unique id and current timestamp.
func New(source Source, kind Kind, summary string) Event {
	return Event{
		ID:     formatID(seq.Add(1)),
		TS:     time.Now().UTC(),
		Source: source,
		Kind:   kind,
		Summary: summary,
	}
}

func formatID(n uint64) string {
	return "evt_" + itoa(n)
}

func itoa(n uint64) string {
	if n == 0 {
		return "0"
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}
