import type { LabEvent } from "./types";

export type Task = {
  tid: number;
  comm: string;
  state: string;
  processor: number;
  voluntary_ctxt_switches: number;
  nonvoluntary_ctxt_switches: number;
  is_thread_group_leader: boolean;
};

export type ThreadSnapshot = {
  pid: number;
  phase?: string;
  threads_from_status: number;
  tasks: Task[];
  goroutines_app?: number;
  gomaxprocs_app?: number;
  num_cpu_app?: number;
  note?: string;
};

type Props = {
  events: LabEvent[];
  selectedPhase: string | null;
  onSelectPhase: (phase: string) => void;
};

function snapFrom(e: LabEvent): ThreadSnapshot | null {
  const d = e.detail as { snapshot?: ThreadSnapshot } | undefined;
  return d?.snapshot ?? null;
}

export function ThreadsView({ events, selectedPhase, onSelectPhase }: Props) {
  const threadEvents = events.filter((e) => e.kind === "thread" && e.source === "REAL" && e.detail);
  const phases = threadEvents.map((e) => {
    const snap = snapFrom(e);
    const phase = (e.detail as { phase?: string })?.phase ?? snap?.phase ?? "?";
    return { phase, event: e, snap };
  }).filter((p) => p.snap);

  const active = phases.find((p) => p.phase === selectedPhase) ?? phases[phases.length - 1] ?? null;
  const snap = active?.snap ?? null;

  return (
    <div>
      <div className="actions" style={{ flexWrap: "wrap" }}>
        {phases.length === 0 && <span className="coming">No samples yet — run the experiment.</span>}
        {phases.map((p) => (
          <button
            key={p.phase + p.event.id}
            type="button"
            className="btn ghost"
            style={
              active?.phase === p.phase
                ? { borderColor: "var(--accent)", color: "var(--accent)" }
                : undefined
            }
            onClick={() => onSelectPhase(p.phase)}
          >
            {p.phase}
            {p.snap
              ? ` · G=${p.snap.goroutines_app ?? "?"} M=${p.snap.tasks.length}`
              : ""}
          </button>
        ))}
      </div>

      {snap && (
        <div className="grid-2" style={{ marginTop: "0.75rem" }}>
          <div className="card">
            <h3>GOROUTINES vs OS THREADS</h3>
            <div className="proc-tree" style={{ fontSize: "0.95rem" }}>
              <div>
                Goroutines (Go runtime){" "}
                <span className="badge REAL">REAL app</span>:{" "}
                <strong>{snap.goroutines_app ?? "—"}</strong>
              </div>
              <div>
                OS threads /proc/task{" "}
                <span className="badge REAL">REAL</span>:{" "}
                <strong>{snap.tasks.length}</strong>
                {snap.threads_from_status ? ` (status Threads=${snap.threads_from_status})` : ""}
              </div>
              <div>
                GOMAXPROCS={snap.gomaxprocs_app ?? "—"} · NumCPU={snap.num_cpu_app ?? "—"}
              </div>
            </div>
            <RatioBar goroutines={snap.goroutines_app ?? 0} threads={snap.tasks.length} />
            <p className="mono" style={{ color: "var(--muted)", marginTop: "0.75rem", fontSize: "0.72rem" }}>
              Goroutine ≠ OS thread. Kernel schedules threads; Go schedules goroutines onto threads.
            </p>
          </div>
          <div className="card">
            <h3>PROCESS → THREADS (from /proc)</h3>
            <div className="proc-tree">
              Process pid={snap.pid}
              {snap.tasks.map((t) => (
                <div key={t.tid}>
                  {t.is_thread_group_leader ? "├── " : "├── "}
                  tid={t.tid} cpu={t.processor} state={t.state}
                  {t.comm ? ` (${t.comm})` : ""}
                  {t.is_thread_group_leader ? " [leader]" : ""}
                  <span style={{ color: "var(--faint)" }}>
                    {" "}
                    vol={t.voluntary_ctxt_switches} nonvol={t.nonvoluntary_ctxt_switches}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>
          GMP MODEL <span className="badge SIMULATION">SIMULATION</span>
        </h3>
        <svg viewBox="0 0 640 160" className="map-svg" style={{ minHeight: 160 }}>
          <rect className="node" x="30" y="20" width="100" height="36" rx="6" />
          <text className="label" x="80" y="43" textAnchor="middle">
            G × N
          </text>
          <rect className="node" x="30" y="70" width="100" height="36" rx="6" />
          <text className="label" x="80" y="93" textAnchor="middle">
            G …
          </text>
          <line className="edge pulse" x1="130" y1="55" x2="200" y2="55" />
          <rect className="node active" x="200" y="35" width="120" height="50" rx="6" />
          <text className="label" x="260" y="65" textAnchor="middle">
            P (GOMAXPROCS)
          </text>
          <line className="edge pulse" x1="320" y1="60" x2="390" y2="60" />
          <rect className="node" x="390" y="20" width="100" height="36" rx="6" />
          <text className="label" x="440" y="43" textAnchor="middle">
            M thread
          </text>
          <rect className="node" x="390" y="70" width="100" height="36" rx="6" />
          <text className="label" x="440" y="93" textAnchor="middle">
            M thread
          </text>
          <line className="edge" x1="490" y1="55" x2="540" y2="55" />
          <rect className="node" x="540" y="35" width="80" height="50" rx="6" />
          <text className="label" x="580" y="65" textAnchor="middle">
            CPU
          </text>
          <text className="sub" x="320" y="145" textAnchor="middle">
            Educational GMP sketch — only M appears in /proc/&lt;pid&gt;/task
          </text>
        </svg>
      </div>
    </div>
  );
}

function RatioBar({ goroutines, threads }: { goroutines: number; threads: number }) {
  const g = Math.max(goroutines, 1);
  const m = Math.max(threads, 1);
  const max = Math.max(g, m);
  return (
    <div style={{ marginTop: "0.85rem" }}>
      <div style={{ marginBottom: 6 }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>
          goroutines
        </div>
        <div style={{ height: 14, background: "var(--bg)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ width: `${(g / max) * 100}%`, height: "100%", background: "var(--accent)" }} />
        </div>
      </div>
      <div>
        <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>
          OS threads
        </div>
        <div style={{ height: 14, background: "var(--bg)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ width: `${(m / max) * 100}%`, height: "100%", background: "var(--real)" }} />
        </div>
      </div>
    </div>
  );
}
