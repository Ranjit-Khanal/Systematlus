# Memory

## Concept

Each process has a **virtual address space**. The kernel maps virtual pages to **physical frames** via **page tables**. Allocating memory often only creates virtual mappings; **touching** a page causes a **page fault** that attaches a physical page (and grows RSS).

## Mental model

```
Virtual address
      ↓
Page table (kernel)
      ↓
Physical frame (RAM)
```

```
make([]byte, N)     → VmSize ↑   (RSS may barely move)
touch each page     → page faults → RSS ↑
drop + return to OS → RSS ↓
```

**Virtual address ≠ physical address.** Never assume they are the same.

## Real Linux behavior

| Source | What it tells you |
|---|---|
| `/proc/<pid>/status` | VmSize, VmRSS, VmData, VmStk, VmExe |
| `/proc/<pid>/maps` | Virtual regions: heap, stack, anon, file-backed |
| `/proc/<pid>/smaps_rollup` | Rss, Pss, Anonymous, Private_Dirty, … |

Anonymous memory is not backed by a file (typical heap / `mmap` anonymous). File-backed mappings come from executables and shared libraries.

## Experiment

Lab → MEMORY → **RUN**. Phases: baseline → allocate → touch → hold → release → done.

## Observation

- After **allocate**, VmSize jumps; RSS often stays relatively low (lazy allocation).
- After **touch**, anonymous RSS / Private_Dirty rises — that is page faults becoming visible.
- After **release** + `FreeOSMemory`, RSS usually falls (Go/runtime + kernel reclaim; not always instant to the byte).

## Why it matters to backend engineering

OOM kills, container memory limits, “why did RSS not drop after I freed?”, and GC behavior are all virtual-memory phenomena. Measuring VmSize alone will mislead you.
