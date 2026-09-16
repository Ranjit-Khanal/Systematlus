# Observability

## Concept

Each lab phase has its own collectors (`/proc`, `ss`, `strace`, experiment stdout). Observability **aggregates** them into one snapshot so you can see host health, tool gaps, network posture, and recent experiment activity together.

## What the dashboard shows (REAL)

| Card | Source |
|---|---|
| Host CPU/memory/uptime | `/proc` |
| Tool matrix | capability probe |
| Interfaces/routes | `ip -j` |
| TCP socket counts by state | `ss -tanp` |
| tcpdump capability | live probe |
| Event ring stats | agent hub (counts by source/kind/experiment) |

Stack diagram in the UI is **SIMULATION**.

## API

```
GET  /api/observability          → snapshot (REAL)
POST /api/observability/refresh → snapshot + publish KindObs event to timeline
```

## Usage

Lab → OBSERVABILITY → **Refresh snapshot** (or **Refresh + publish event** to record it on the timeline).

Run experiments first — the event ring section is most useful after activity.

## Why it matters

Production observability is the same idea: metrics + logs + traces + host facts, correlated. This lab keeps each collector honest (REAL labels) and shows how they compose.
