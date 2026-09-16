import { useMemo, useState } from "react";
import type { LabEvent, Source } from "./types";

type Props = {
  events: LabEvent[];
  selected: LabEvent | null;
  onSelect: (e: LabEvent | null) => void;
  onClear: () => void;
};

export function Timeline({ events, selected, onSelect, onClear }: Props) {
  const [source, setSource] = useState<"ALL" | Source>("ALL");
  const [kind, setKind] = useState("ALL");

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (source !== "ALL" && e.source !== source) return false;
      if (kind !== "ALL" && e.kind !== kind) return false;
      return true;
    });
  }, [events, source, kind]);

  const kinds = useMemo(() => {
    const s = new Set(events.map((e) => e.kind));
    return ["ALL", ...Array.from(s).sort()];
  }, [events]);

  return (
    <aside className="timeline-rail">
      <div className="timeline-head">
        <h2>EVENT TIMELINE</h2>
        <div className="filters">
          <select value={source} onChange={(e) => setSource(e.target.value as "ALL" | Source)}>
            <option value="ALL">source: ALL</option>
            <option value="REAL">REAL</option>
            <option value="SIMULATION">SIMULATION</option>
            <option value="DERIVED">DERIVED</option>
          </select>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            {kinds.map((k) => (
              <option key={k} value={k}>
                kind: {k}
              </option>
            ))}
          </select>
          <button className="btn ghost" type="button" onClick={onClear}>
            Clear
          </button>
        </div>
      </div>
      <div className="timeline-list">
        {filtered.length === 0 && <div className="mono" style={{ padding: "0.75rem", color: "var(--muted)" }}>No events yet. Run an experiment.</div>}
        {[...filtered].reverse().map((e) => (
          <div
            key={e.id}
            className={`evt${selected?.id === e.id ? " selected" : ""}`}
            onClick={() => onSelect(e)}
          >
            <div className="time">
              {formatTS(e.ts)}
              {e.rel_ns != null && e.rel_ns >= 0 ? `  +${(e.rel_ns / 1e6).toFixed(3)}ms` : ""}
            </div>
            <span className={`badge ${e.source}`}>{e.source}</span>
            <div className="sum">{e.summary}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function formatTS(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString(undefined, { hour12: false }) + "." + String(d.getMilliseconds()).padStart(3, "0");
  } catch {
    return ts;
  }
}
