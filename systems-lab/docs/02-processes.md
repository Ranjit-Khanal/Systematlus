# Processes

## Concept

A **process** is an address space + one or more threads of execution + kernel bookkeeping (credentials, open files, etc.). Creating a child yields a new PID with PPID pointing at the parent.

## Mental model

```
Parent
  │  clone / fork + exec (via Go os/exec)
  ├──────────────┐
  ▼              ▼
Parent         Child
```

## Real Linux behavior

- PIDs are allocated by the kernel.
- `/proc/<pid>/status` exposes state, PPID, memory summaries, threads.
- When a process exits, its `/proc` directory disappears (after reaping).

## Experiment

Lab → PROCESSES → **RUN**. Observe parent/child PIDs from REAL `/proc` samples.

## Observation

Compare `ps` / `cat /proc/<pid>/status` with the timeline.

## Why it matters

Workers, sidecar processes, and crashes are process-lifecycle problems before they are “distributed systems” problems.
