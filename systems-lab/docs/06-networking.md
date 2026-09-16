# Networking basics

## Concept

An application talks to the network through a **socket**. On Linux, that means:

```
App → socket API → TCP (or UDP) → IP → network interface → wire (or loopback)
```

Loopback (`127.0.0.1` / `lo`) still uses this stack — it just never leaves the machine.

## Mental model

```
Go client                    Go server
   │                            ▲
   ▼                            │
socket                       socket
   │                            ▲
   └──── TCP / IP / lo ─────────┘
```

## Real Linux behavior

| Tool | What you see |
|---|---|
| `ip -j addr` | Interfaces, addresses, operstate |
| `ip -j route` | Routing table / default gateway device |
| `ss -tanp` | TCP socket state: LISTEN, ESTAB, … |
| `ping` | ICMP reachability + RTT (when allowed) |

`traceroute` / `tcpdump` may be missing or permission-denied — the lab reports that; it does not invent packets.

## Experiment

Lab → NETWORK → **RUN**. Phases: listen → connected → http_exchange → closed.

## Observation

- **listen**: `LISTEN` on `127.0.0.1:<port>`
- **connected**: `ESTAB` (ss abbreviation) between client ephemeral port and server port
- Host NICs (`wlp*`, `enp*`, `lo`) and default route appear from `ip` even before the experiment

## Why it matters

Backend latency and failures sit on this path. Distinguishing “DNS”, “TCP connect”, “TLS”, and “HTTP” starts with being able to see sockets and interfaces as first-class objects.
