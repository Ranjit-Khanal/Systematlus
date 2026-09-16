# Load

## Concept

Under concurrency, latency is a **distribution**, not a single number. Mean/p50 can look fine while p99 hurts users.

## Mental model

```
N requests, C concurrent workers
  → overlapping TCP connections
    → handler execution
      → latency samples → p50 / p95 / p99
```

## Real vs derived

| Item | Label |
|---|---|
| Per-request success/error + duration | REAL |
| ok/err counts, wall time | REAL |
| avg / p50 / p95 / p99 / rps | DERIVED from REAL samples |
| Queueing diagram | SIMULATION |
| `ss` socket count during `PHASE=running` | REAL |

## Experiment

Lab → LOAD TEST → **RUN — concurrent requests**.

Defaults: 40 requests, concurrency 8 (override with `SYSLAB_LOAD_N` / `SYSLAB_LOAD_C` on the experiment process).

## Why it matters

Capacity planning and “it works on my machine” both fail without looking at the tail. Load tests turn anecdotes into measured distributions.
