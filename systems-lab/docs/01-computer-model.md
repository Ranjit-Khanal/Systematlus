# Computer model

## Concept

A backend program is not talking to “the network” or “the disk” directly. It runs in **user space**, asks the **kernel** for services, and the kernel talks to hardware and other processes.

## Mental model

```
Application (Go)
    → Go runtime
        → system call
            → Linux kernel
                → devices / other processes / network
```

## Real Linux behavior

- User mode cannot execute privileged instructions or map arbitrary physical memory.
- Crossing into the kernel uses the syscall ABI (`syscall` instruction on x86_64).
- `/proc` and `/sys` are windows the kernel exposes for observation.

## Experiment (MVP)

Use the System Map while running Process or Syscalls. Watch REAL events land in the timeline and SIMULATION pulses on the map.

## Why it matters to backend engineering

Latency, failures, and resource limits almost always involve this stack — not just your business logic.
