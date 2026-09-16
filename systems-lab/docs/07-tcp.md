# TCP connections

## Concept

TCP is **connection-oriented**: before data flows, client and server perform a **three-way handshake** (SYN → SYN-ACK → ACK). When done, both sides are in **ESTABLISHED**. Closing moves through FIN/FIN-ACK states (FIN-WAIT, CLOSE-WAIT, TIME-WAIT, …).

## Mental model

```
CLIENT                         SERVER
  |                               |
  | -------- SYN ---------------> |
  | <------- SYN-ACK ------------ |
  | -------- ACK ---------------> |
  |         ESTABLISHED           |
  | -------- DATA --------------> |
  | <------- DATA --------------- |
  | -------- FIN ---------------> |
  |         ... teardown ...      |
```

## What is REAL in this lab

| Source | What |
|---|---|
| `ss -tanp` | LISTEN, ESTAB, FIN-WAIT-*, CLOSE-WAIT, TIME-WAIT |
| App stdout | DATA_SENT, client/server addresses |
| Rapid ss poll | Catches transient teardown states |

## What is SIMULATION

| Item | Why |
|---|---|
| SYN / SYN-ACK / ACK arrows when only ESTAB is seen | Loopback handshakes are often too fast for ss; we infer the handshake when ESTAB appears |
| Individual sequence numbers | Not read from packets (tcpdump blocked without CAP_NET_RAW) |

If ss shows **SYN-SENT** or **SYN-RECV**, those steps are labeled REAL.

## Experiment

Lab → TCP → **RUN**. Phases include listen, handshake poll, connected, data, close poll.

## Why it matters

“Connection refused”, half-open connections, TIME-WAIT piles, and load-balancer health checks are all TCP state problems — not HTTP problems.
