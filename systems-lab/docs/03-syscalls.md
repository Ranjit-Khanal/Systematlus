# System calls

## Concept

A **system call** is a controlled entry into the kernel: open a file, read bytes, create a socket, map memory.

## Mental model

```
Go code
  → runtime / stdlib
    → syscall (openat, read, write, close, …)
      → kernel
```

**Not every Go function is a syscall.** Buffering, the runtime scheduler, and libc-like wrappers mean many language operations never enter the kernel — or enter it differently than you expect.

## Real Linux behavior

`strace -f -tt -T` shows syscall name, arguments, return value/errno, and duration for a process tree.

## Experiment

Lab → SYSCALLS → **RUN**. Filter the timeline to `kind=syscall` and `source=REAL`.

## Observation

Expect `openat`, `write`, `read`, `close`, plus runtime noise such as `mmap` / `brk`. Click an event for args and duration.

## Why it matters

I/O latency, `EMFILE`, permission errors, and “why is this blocking?” are syscall-level phenomena.
