import type { LabEvent } from "./types";

export type MemSnapshot = {
  pid: number;
  phase?: string;
  page_size: number;
  status: {
    vm_peak_kb?: number;
    vm_size_kb: number;
    vm_hwm_kb?: number;
    vm_rss_kb: number;
    vm_data_kb: number;
    vm_stack_kb: number;
    vm_exe_kb: number;
  };
  smaps_rollup: {
    rss_kb: number;
    pss_kb: number;
    anonymous_kb: number;
    private_dirty_kb: number;
    shared_clean_kb: number;
  };
  by_kind: { kind: string; regions: number; virtual_kb: number }[];
  note?: string;
};

const KIND_COLOR: Record<string, string> = {
  stack: "#e8a54b",
  heap: "#5b9fd4",
  anon: "#3dd68c",
  file: "#8490a6",
  vdso: "#6cb6ff",
  vvar: "#6cb6ff",
  vsyscall: "#6cb6ff",
};

type Props = {
  events: LabEvent[];
  selectedPhase: string | null;
  onSelectPhase: (phase: string) => void;
};

function snapFromEvent(e: LabEvent): MemSnapshot | null {
  const d = e.detail as { snapshot?: MemSnapshot; phase?: string } | undefined;
  return d?.snapshot ?? null;
}

export function MemoryView({ events, selectedPhase, onSelectPhase }: Props) {
  const memEvents = events.filter((e) => e.kind === "memory" && e.source === "REAL" && e.detail);
  const phases = memEvents
    .map((e) => {
      const snap = snapFromEvent(e);
      const phase = (e.detail as { phase?: string })?.phase ?? snap?.phase ?? "?";
      return { phase, event: e, snap };
    })
    .filter((p) => p.snap);

  const active =
    phases.find((p) => p.phase === selectedPhase) ?? phases[phases.length - 1] ?? null;
  const snap = active?.snap ?? null;

  const baseline = phases.find((p) => p.phase === "baseline")?.snap;
  const compare =
    snap && baseline
      ? {
          dVmSize: snap.status.vm_size_kb - baseline.status.vm_size_kb,
          dRss: snap.status.vm_rss_kb - baseline.status.vm_rss_kb,
          dAnon: snap.smaps_rollup.anonymous_kb - baseline.smaps_rollup.anonymous_kb,
        }
      : null;

  return (
    <div>
      <div className="actions" style={{ flexWrap: "wrap" }}>
        {phases.length === 0 && <span className="coming">No memory samples yet — run the experiment.</span>}
        {phases.map((p) => (
          <button
            key={p.phase + p.event.id}
            type="button"
            className={`btn ghost${active?.phase === p.phase ? "" : ""}`}
            style={
              active?.phase === p.phase
                ? { borderColor: "var(--accent)", color: "var(--accent)" }
                : undefined
            }
            onClick={() => onSelectPhase(p.phase)}
          >
            {p.phase}
            {p.snap ? ` · RSS ${fmtKB(p.snap.status.vm_rss_kb)}` : ""}
          </button>
        ))}
      </div>

      {snap && (
        <div className="grid-2" style={{ marginTop: "0.75rem" }}>
          <div className="card">
            <h3>VIRTUAL ADDRESS SPACE (by maps kind) · REAL</h3>
            <AddressSpaceBar byKind={snap.by_kind} />
            <p className="mono" style={{ color: "var(--muted)", marginTop: "0.75rem" }}>
              page_size={snap.page_size}B · regions shown as proportional virtual span
            </p>
          </div>
          <div className="card">
            <h3>ACCOUNTING · REAL (/proc status + smaps_rollup)</h3>
            <table className="tools-table">
              <tbody>
                <tr>
                  <td>VmSize (virtual)</td>
                  <td className="mono">{fmtKB(snap.status.vm_size_kb)}</td>
                </tr>
                <tr>
                  <td>VmRSS (resident)</td>
                  <td className="mono">{fmtKB(snap.status.vm_rss_kb)}</td>
                </tr>
                <tr>
                  <td>Pss (proportional)</td>
                  <td className="mono">{fmtKB(snap.smaps_rollup.pss_kb)}</td>
                </tr>
                <tr>
                  <td>Anonymous</td>
                  <td className="mono">{fmtKB(snap.smaps_rollup.anonymous_kb)}</td>
                </tr>
                <tr>
                  <td>Private_Dirty</td>
                  <td className="mono">{fmtKB(snap.smaps_rollup.private_dirty_kb)}</td>
                </tr>
                <tr>
                  <td>VmData / VmStk / VmExe</td>
                  <td className="mono">
                    {fmtKB(snap.status.vm_data_kb)} / {fmtKB(snap.status.vm_stack_kb)} /{" "}
                    {fmtKB(snap.status.vm_exe_kb)}
                  </td>
                </tr>
              </tbody>
            </table>
            {compare && (
              <p className="mono" style={{ marginTop: "0.75rem", color: "var(--accent)" }}>
                Δ vs baseline — VmSize {signedKB(compare.dVmSize)} · RSS {signedKB(compare.dRss)} · anon{" "}
                {signedKB(compare.dAnon)}
                <span className="badge DERIVED" style={{ marginLeft: 8 }}>
                  DERIVED
                </span>
              </p>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>MENTAL MODEL</h3>
        <pre className="mono" style={{ margin: 0, color: "var(--muted)", lineHeight: 1.5 }}>{`make([]byte)     → virtual mapping grows (often little RSS yet)
touch each page  → page fault → physical page → RSS rises   [REAL]
drop + GC        → pages may return to OS → RSS falls       [REAL]

virtual address  →  page table  →  physical frame
                 [SIMULATION diagram — we do not dump pagemap here]`}</pre>
      </div>

      <PageWalkDiagram />
    </div>
  );
}

function AddressSpaceBar({ byKind }: { byKind: MemSnapshot["by_kind"] }) {
  // Emphasize heap/anon/stack/file; ignore tiny helper mappings for bar scale.
  const focus = byKind.filter((k) => ["stack", "heap", "anon", "file"].includes(k.kind));
  const total = focus.reduce((s, k) => s + Math.max(k.virtual_kb, 1), 0) || 1;
  // Log-ish display: use sqrt so huge anon mmap doesn't crush stack visually, but still REAL magnitudes in labels.
  const weights = focus.map((k) => ({
    ...k,
    w: Math.sqrt(Math.max(k.virtual_kb, 1)),
  }));
  const wSum = weights.reduce((s, k) => s + k.w, 0) || 1;

  return (
    <div>
      <div style={{ display: "flex", height: 160, borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)" }}>
        {weights.map((k) => (
          <div
            key={k.kind}
            title={`${k.kind}: ${fmtKB(k.virtual_kb)} virtual across ${k.regions} regions`}
            style={{
              width: `${(k.w / wSum) * 100}%`,
              background: KIND_COLOR[k.kind] ?? "#5a6578",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              padding: "0.35rem",
              minWidth: k.virtual_kb > 0 ? 28 : 0,
            }}
          >
            <span className="mono" style={{ fontSize: 10, color: "#0c1017", fontWeight: 700, writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
              {k.kind}
            </span>
          </div>
        ))}
      </div>
      <ul className="mono" style={{ margin: "0.75rem 0 0", paddingLeft: "1.1rem", color: "var(--muted)", fontSize: "0.75rem" }}>
        {focus.map((k) => (
          <li key={k.kind}>
            <span style={{ color: KIND_COLOR[k.kind] }}>■</span> {k.kind}: {fmtKB(k.virtual_kb)} virtual · {k.regions} regions ·{" "}
            {((k.virtual_kb / total) * 100).toFixed(1)}% of shown
          </li>
        ))}
      </ul>
    </div>
  );
}

function PageWalkDiagram() {
  return (
    <div className="card" style={{ marginTop: "1rem" }}>
      <h3>
        PAGE WALK <span className="badge SIMULATION">SIMULATION</span>
      </h3>
      <svg viewBox="0 0 640 140" className="map-svg" style={{ minHeight: 140 }}>
        <rect className="node" x="20" y="40" width="140" height="50" rx="6" />
        <text className="label" x="90" y="70" textAnchor="middle">
          Virtual Addr
        </text>
        <line className="edge pulse" x1="160" y1="65" x2="220" y2="65" />
        <rect className="node" x="220" y="40" width="140" height="50" rx="6" />
        <text className="label" x="290" y="70" textAnchor="middle">
          Page Table
        </text>
        <line className="edge pulse" x1="360" y1="65" x2="420" y2="65" />
        <rect className="node" x="420" y="40" width="160" height="50" rx="6" />
        <text className="label" x="500" y="70" textAnchor="middle">
          Physical Frame
        </text>
        <text className="sub" x="320" y="120" textAnchor="middle">
          Educational only — not a live pagemap / PTE dump
        </text>
      </svg>
    </div>
  );
}

function fmtKB(kb: number) {
  if (kb >= 1024 * 1024) return `${(kb / 1024 / 1024).toFixed(2)} GiB`;
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MiB`;
  return `${kb} KiB`;
}

function signedKB(kb: number) {
  const sign = kb > 0 ? "+" : "";
  return sign + fmtKB(kb);
}
