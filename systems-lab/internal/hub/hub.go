package hub

import (
	"sync"

	"github.com/hecker/systematlus/systems-lab/internal/events"
)

// Hub fans out lab events to WebSocket subscribers.
type Hub struct {
	mu   sync.RWMutex
	subs map[chan events.Event]struct{}
	ring []events.Event
	cap  int
}

func New(ringCap int) *Hub {
	if ringCap < 32 {
		ringCap = 256
	}
	return &Hub{
		subs: make(map[chan events.Event]struct{}),
		ring: make([]events.Event, 0, ringCap),
		cap:  ringCap,
	}
}

func (h *Hub) Publish(e events.Event) {
	h.mu.Lock()
	if len(h.ring) >= h.cap {
		copy(h.ring, h.ring[1:])
		h.ring = h.ring[:h.cap-1]
	}
	h.ring = append(h.ring, e)
	subs := make([]chan events.Event, 0, len(h.subs))
	for ch := range h.subs {
		subs = append(subs, ch)
	}
	h.mu.Unlock()

	for _, ch := range subs {
		select {
		case ch <- e:
		default:
			// Slow consumer: drop rather than block the lab.
		}
	}
}

func (h *Hub) Subscribe(buf int) (<-chan events.Event, func()) {
	if buf < 16 {
		buf = 64
	}
	ch := make(chan events.Event, buf)
	h.mu.Lock()
	h.subs[ch] = struct{}{}
	// Replay recent history so a late UI still sees the last experiment.
	replay := append([]events.Event(nil), h.ring...)
	h.mu.Unlock()
	go func() {
		for _, e := range replay {
			select {
			case ch <- e:
			default:
				return
			}
		}
	}()
	unsub := func() {
		h.mu.Lock()
		delete(h.subs, ch)
		h.mu.Unlock()
		close(ch)
	}
	return ch, unsub
}

func (h *Hub) Recent(n int) []events.Event {
	h.mu.RLock()
	defer h.mu.RUnlock()
	if n <= 0 || n > len(h.ring) {
		n = len(h.ring)
	}
	out := make([]events.Event, n)
	copy(out, h.ring[len(h.ring)-n:])
	return out
}

func (h *Hub) Clear() {
	h.mu.Lock()
	h.ring = h.ring[:0]
	h.mu.Unlock()
}
