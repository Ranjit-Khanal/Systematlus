import type { LabEvent } from "./types";

const LAYER_BLURBS: Record<string, string> = {
  application: "Your Go program: intentional work in user space.",
  go_runtime: "Go runtime schedules goroutines onto OS threads (M). The kernel only schedules those threads onto CPUs.",
  syscall: "The ABI boundary: user mode requests a kernel service.",
  kernel: "Privileged code that implements process, memory, VFS, and networking.",
  process: "Task structs, PIDs/TIDs, and the scheduler’s view of runnable work.",
  memory: "Virtual address spaces, page tables, and physical frames — VmSize vs RSS is the key distinction.",
  vfs: "Virtual filesystem: path lookup, page cache, inode/dentry.",
  net: "Sockets, TCP/IP, and network interfaces — visible via ss and ip; packets need capture caps.",
};

type Props = {
  event: LabEvent | null;
  layer: string | null;
};

export function LearningPane({ event, layer }: Props) {
  return (
    <div className="learn">
      <details open>
        <summary>What just happened?</summary>
        <p>
          {event
            ? event.summary
            : "Run Process, Syscalls, or Memory to generate a REAL timeline. Click an event for details."}
        </p>
      </details>
      <details open>
        <summary>Why did it happen?</summary>
        <p>
          User-space programs cannot directly manipulate hardware or other processes’ memory. They ask the kernel via
          system calls. Go usually goes through its runtime before the actual syscall instruction.
        </p>
      </details>
      <details>
        <summary>What does Linux actually do?</summary>
        <p>
          {layer && LAYER_BLURBS[layer]
            ? LAYER_BLURBS[layer]
            : "The kernel validates arguments, may sleep (I/O), updates bookkeeping (/proc), and returns a result or errno to user space."}
        </p>
      </details>
      <details>
        <summary>What can we observe?</summary>
        <p>
          REAL: /proc status/maps/smaps_rollup (VmSize, RSS, anonymous), strace syscalls. DERIVED: deltas vs baseline.
          SIMULATION: map pulses and the page-walk diagram — not live PTE dumps.
        </p>
      </details>
      <details>
        <summary>What can we NOT observe directly (yet)?</summary>
        <p>
          Hardware ring transitions, page-table walks, and packet bytes require perf/eBPF/tcpdump capabilities that are
          blocked or missing on this host — see TOOLS.
        </p>
      </details>
      <details>
        <summary>Try this yourself</summary>
        <p className="mono">
          {`ps -o pid,ppid,state,rss,cmd -p <pid>
cat /proc/<pid>/status
grep -E 'Rss|Anonymous|Pss' /proc/<pid>/smaps_rollup
strace -f -tt -T -o /tmp/t.out -- ./bin/exp-syscalls`}
        </p>
      </details>
      <details>
        <summary>Go deeper</summary>
        <p>docs/02-processes.md … docs/24-postgresql-connection-protocol-pooling.md</p>
      </details>
      {event?.detail && (
        <div className="detail-box">{JSON.stringify(event.detail, null, 2)}</div>
      )}
    </div>
  );
}
