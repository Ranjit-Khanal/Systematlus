# Computer Systems Lab

Local visual laboratory for observing **real** Linux behavior under small Go programs.

This directory is separate from the root SystemAtlas content site. Here, measurements come from `/proc`, `strace`, and other host tools — never silently invented.

## Requirements (Ubuntu)

- Go 1.22+
- Node.js 20+
- `make`
- `strace` (syscall experiment)

```bash
sudo apt update
sudo apt install -y golang-go make strace iproute2
# Optional later phases:
# sudo apt install -y linux-tools-generic tcpdump tshark traceroute bpftrace
```

## Quick start

```bash
cd systems-lab
make dev
```

Open **http://localhost:5174**

- Agent API: `http://127.0.0.1:8080`
- WebSocket: `ws://127.0.0.1:8080/api/ws` (also proxied via Vite)

## What the MVP includes

| Feature | Status |
|---|---|
| System map | ✓ |
| Live event timeline (filter REAL / SIMULATION) | ✓ |
| Process creation experiment + `/proc` | ✓ REAL |
| Syscall experiment via `strace` | ✓ REAL |
| Memory experiment (alloc/touch/release + maps/smaps) | ✓ REAL |
| Scheduler experiment (goroutines vs `/proc/.../task`) | ✓ REAL |
| Network experiment (local HTTP + `ss`/`ip`) | ✓ REAL |
| TCP experiment (handshake/teardown via `ss`) | ✓ REAL + labeled SIMULATION for inferred SYN |
| Host / tool capability probe | ✓ REAL |
| DNS experiment (system resolver + optional dig) | ✓ REAL |
| HTTP experiment (local net/http + timings) | ✓ REAL |
| Database experiment (SQLite + query timings) | ✓ REAL |
| Packets experiment (tcpdump or honest blocked fallback) | ✓ REAL capability + REAL/SIMULATION packets |
| Failures experiment (fault matrix) | ✓ REAL |
| Load experiment (concurrent HTTP + percentiles) | ✓ REAL + DERIVED |
| Observability dashboard (aggregated collectors) | ✓ REAL |
| E2E request (DNS → TCP → HTTP → SQLite) | ✓ REAL |
| PostgreSQL internals reference (8 chapters) | ✓ docs + UI |

## REAL vs SIMULATION

- **REAL** — `/proc` fields, strace lines, host CPU/memory from `/proc`
- **SIMULATION** — system-map edge pulses that visualize where an event sits

If a tool is missing or permission-denied, the UI says so. It does not fabricate kernel events.

## Commands

```bash
make test              # parser /proc tests
make build             # agent + experiments + web production build
make verify            # build, start agent, run both experiments via HTTP
make clean
```

## Layout

See [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md).

## Docs

- [01-computer-model.md](./docs/01-computer-model.md)
- [02-processes.md](./docs/02-processes.md)
- [03-syscalls.md](./docs/03-syscalls.md)
- [04-memory.md](./docs/04-memory.md)
- [05-scheduling.md](./docs/05-scheduling.md)
- [06-networking.md](./docs/06-networking.md)
- [07-tcp.md](./docs/07-tcp.md)
- [08-dns.md](./docs/08-dns.md)
- [09-http.md](./docs/09-http.md)
- [10-database.md](./docs/10-database.md)
- [11-packets.md](./docs/11-packets.md)
- [12-failures.md](./docs/12-failures.md)
- [13-load.md](./docs/13-load.md)
- [14-observability.md](./docs/14-observability.md)
- [15-e2e.md](./docs/15-e2e.md)
- [16-postgresql-internals-index.md](./docs/16-postgresql-internals-index.md) — chapters 17–24
