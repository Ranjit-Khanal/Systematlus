# Scheduling — processes, threads, goroutines

## Concept

- A **process** is an address space + credentials + resources.
- An **OS thread** (task) is what the Linux scheduler runs on a CPU. Visible as `/proc/<pid>/task/<tid>`.
- A **goroutine** is a Go runtime green thread. The kernel does **not** see goroutines.

**Goroutine ≠ OS thread.**

## Mental model (GMP)

```
G  goroutine     — many
P  processor     — GOMAXPROCS contexts
M  OS thread     — kernel-scheduled
        ↓
      CPU
```

## Real Linux behavior

| Source | What |
|---|---|
| `/proc/<pid>/task/` | One directory per OS thread (TID) |
| `/proc/.../stat` field 39 | Last CPU (processor) |
| `/proc/.../status` | `Threads:`, voluntary/nonvoluntary ctxt switches |
| `runtime.NumGoroutine()` | App-level count (not in the kernel) |

Linux CFS schedules **M**. The Go runtime schedules **G** onto **M**.

## Experiment

Lab → CPU / THREADS → **RUN**. Phases: baseline → many_goroutines → cpu_bound → lock_os_thread → cooldown.

With `GOMAXPROCS=2`, tens of busy goroutines still show only a handful of OS threads in `/proc`.

## Observation

Compare `GOROUTINES=` in the timeline to `len(tasks)`. During `many_goroutines` / `cpu_bound`, G ≫ M.

## Why it matters

Blocking syscalls, `GOMAXPROCS`, thread explosions, and “why is my Go service using only 2 cores?” are scheduler/runtime interactions — not mysterious language magic.
