# Computer Systems Lab — Development Plan

## 0. Relationship to this repository

The repository root (`systematlus`) is **SystemAtlas**: a static React content site for backend concepts (diagrams, topics, no live OS measurement).

**Computer Systems Lab** is a separate local product living under `systems-lab/`. It measures a real Ubuntu host. It does not reuse SystemAtlas’s React Flow topic model or static content pipeline.

| | SystemAtlas (repo root) | Systems Lab (`systems-lab/`) |
|---|---|---|
| Purpose | Search → read → diagram | Run → observe → visualize → explain |
| Data | Bundled TypeScript topics | Live `/proc`, strace, `ss`, etc. |
| Backend | None | Go agent |
| Truth model | Educational diagrams | REAL vs SIMULATION labels |

---

## 1. Host environment (measured 2026-09-16)

| Item | Value |
|---|---|
| OS | Ubuntu 24.04-based (`7.0.0-28-generic`) |
| Kernel | Linux 7.0.0-28-generic x86_64 |
| CPU | AMD Ryzen 5 5600H, 6C/12T, 14 GiB RAM |
| Go | 1.22.2 ✓ |
| Node | v24.13.0 ✓ |
| Make | ✓ |

### Tool availability

| Tool | Present | Usable without root? | Notes |
|---|---|---|---|
| `go` | ✓ | ✓ | Build + experiment binaries |
| `strace` | ✓ | ✓ (own children) | `yama/ptrace_scope=1` — can attach to descendants |
| `/proc` | ✓ | ✓ | Primary REAL data source for MVP |
| `ss` | ✓ | ✓ | Socket stats (later phases) |
| `ip` | ✓ | ✓ | Interfaces/routes (later) |
| `perf` | ✓ installed | ✗ | `perf_event_paranoid=4` — blocked |
| `tcpdump` | ✓ installed | ✗ | Needs `CAP_NET_RAW` / root |
| `tshark` | ✗ | — | Not installed |
| `traceroute` | ✗ | — | Not installed |
| `bpftrace` | ✗ | — | Not installed |
| passwordless `sudo` | ✗ | — | Must never assume root |

**MVP rule:** Prefer `/proc` + child `strace`. Surface missing/blocked tools explicitly (`perf unavailable`, `tcpdump: permission denied`) — never silently fake kernel events.

---

## 2. Architecture

```
systems-lab/
├── apps/
│   ├── agent/                 # Go: HTTP + WebSocket control plane
│   └── web/                   # React + TS + Vite laboratory UI
├── experiments/               # Small Go programs the agent runs
│   ├── processes/
│   └── syscalls/
├── internal/                  # Shared Go libraries (agent only)
│   ├── events/                # Event model + REAL/SIMULATION
│   ├── proc/                  # /proc parsers
│   ├── tracer/                # strace runner + parser
│   ├── tools/                 # Capability probe
│   └── hub/                   # Fan-out event hub → WebSocket
├── docs/                      # Learning docs (stubs in MVP)
├── scripts/
├── Makefile                   # `make dev` → agent + web
├── DEVELOPMENT_PLAN.md
└── README.md
```

### Runtime topology

```
┌─────────────┐  HTTP/WS   ┌──────────────────┐  exec/strace  ┌──────────────┐
│  React UI   │◄──────────►│  Go agent        │──────────────►│  experiment  │
│  :5174      │  events    │  :8080           │  /proc read   │  binary      │
└─────────────┘            │  event hub       │◄──────────────│  (child)     │
                           └──────────────────┘               └──────────────┘
```

### Event contract (all phases)

```json
{
  "id": "evt_…",
  "ts": "2026-09-16T10:32:04.123Z",
  "rel_ns": 143000,
  "source": "REAL",
  "kind": "syscall",
  "layer": "syscall",
  "experiment": "syscalls",
  "pid": 1234,
  "tid": 1234,
  "summary": "openat(\"…\", O_RDONLY) = 3",
  "detail": { … },
  "explain_key": "syscall.openat"
}
```

- `source`: **`REAL`** | **`SIMULATION`** | **`DERIVED`**
  - REAL = measured from kernel/userspace tooling
  - SIMULATION = educational animation with no measurement behind it
  - DERIVED = computed from REAL (e.g. duration deltas) — labeled as such

### Agent API (MVP)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness |
| GET | `/api/tools` | Tool/capability matrix |
| GET | `/api/host` | Kernel, CPU, memory summary (from `/proc`) |
| GET | `/api/proc/{pid}` | Snapshot of important `/proc/<pid>/*` |
| POST | `/api/experiments/process/run` | Run process experiment |
| POST | `/api/experiments/syscalls/run` | Run syscall experiment under strace |
| GET | `/api/ws` | WebSocket event stream |

---

## 3. MVP scope (Phase 0) — implement now

### Include

1. Go agent with WebSocket event hub
2. Tool/host probes (`/api/tools`, `/api/host`)
3. `/proc` collector + parsers (status, cmdline, maps summary, stat)
4. **Experiment: Processes** — parent/child via `os/exec` or `syscall.ForkExec` style; emit REAL PID/PPID/state/memory
5. **Experiment: Syscalls** — small Go file open/read/write/close under `strace -f -tt -T`; parse into timeline
6. React UI: lab shell, System Map, timeline, process + syscall panels, Learning Mode panes
7. `make dev` (agent + vite concurrently)
8. Unit tests for `/proc` and strace parsers
9. Docs stubs: `docs/01-computer-model.md`, `02-processes.md`, `03-syscalls.md`
10. README with Ubuntu setup

### Explicitly out of MVP

Memory deep-dive, scheduler, networking, TCP, DNS, HTTP lab, PostgreSQL, failures, load, eBPF, packet capture.

### REAL vs SIMULATION in MVP

| What | Label |
|---|---|
| PID, PPID, state, VmRSS, start time from `/proc` | REAL |
| strace syscall lines (name, args, retval, errno, duration) | REAL |
| Host CPU count, MemTotal from `/proc` | REAL |
| Animated arrows on System Map following events | SIMULATION (driven by REAL events) |
| “Privilege transition” decorative mode switch | SIMULATION |
| Invented TCP SYN / packet fields | Forbidden |

---

## 4. Phased roadmap

| Phase | Deliverable | Depends on |
|---|---|---|
| **0 — MVP** | Agent, UI shell, process + syscall, timeline, /proc | Tools above |
| **1 — Memory** | maps/smaps viz, alloc experiment | Phase 0 ✓ |
| **2 — Threads** | goroutine vs OS thread demo, `/proc/<pid>/task` | Phase 0 ✓ |
| **3 — Network basics** | local Go client/server, `ss`, `ip` | Phase 0 ✓ |
| **4 — TCP viz** | handshake states from `ss` + app events | Phase 3 ✓ |
| **5 — DNS + HTTP** | real lookups + net/http timeline | Phase 3 ✓ |
| **6 — Database** | SQLite + query timings via database/sql | Phase 5 ✓ |
| **7 — Packets** | tcpdump when caps allow; clear fallback | CAP_NET_RAW ✓ |
| **8 — Postgres (optional)** | Docker Postgres, same handler pattern | Docker |
| **9 — Failures + Load** | controlled faults, load generator | Phase 5 ✓ |
| **10 — Observability** | dashboard aggregating collectors | Prior phases ✓ |
| **11 — E2E request** | single “SEND REQUEST” cross-layer timeline | Phase 5+ ✓ |

Optional later: `perf`/`bpftrace` behind capability gates + install docs.

---

## 5. Engineering rules (enforced)

1. Never present SIMULATION as REAL.
2. Missing tool → explicit UI message + install hint.
3. No root required for MVP.
4. Experiments are independently runnable binaries under `experiments/`.
5. Parsers have table-driven tests.
6. Prefer stdlib; add deps only when clearly needed (`gorilla/websocket` or `coder/websocket` for WS).
7. Keep frontend lean: React + Vite + TS; SVG for maps; no heavy UI kit.

---

## 6. Verification checklist (Phase 0)

- [ ] `make build` succeeds
- [ ] `make test` passes parser tests
- [ ] `make dev` starts agent `:8080` and web `:5174`
- [ ] Process experiment shows parent + child with REAL PIDs
- [ ] Syscall experiment shows REAL openat/read/write/close timeline
- [ ] Timeline filters by source/kind
- [ ] `/api/tools` reports perf/tcpdump blocked or missing accurately

---

## 7. Immediate next step after this document

Implement Phase 0 MVP only, run it, and report:

- what was built
- what is REAL vs SIMULATION
- how to run
- what to observe
- what to build next
