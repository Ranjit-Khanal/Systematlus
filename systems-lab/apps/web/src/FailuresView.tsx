import type { LabEvent } from "./types";

type FaultRow = {
  fault: string;
  outcome: string;
  status?: number;
  duration_ms: number;
  err?: string;
};

type Props = { events: LabEvent[] };

function latestSummary(events: LabEvent[]): FaultRow[] | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.kind === "failure" && e.explain_key === "failure.summary" && e.source === "REAL") {
      return ((e.detail as { results?: FaultRow[] })?.results) ?? null;
    }
  }
  return null;
}

export function FailuresView({ events }: Props) {
  const flEvents = events.filter((e) => e.experiment === "failures" && e.source === "REAL");
  const results = latestSummary(flEvents);
  const injects = flEvents.filter((e) => e.explain_key === "failure.inject");

  return (
    <div>
      {!results && <p className="coming">Run the experiment to measure REAL client outcomes for each fault.</p>}

      {results && (
        <div className="card">
          <h3>FAULT MATRIX · REAL</h3>
          <table className="tools-table">
            <thead>
              <tr>
                <th>fault</th>
                <th>outcome</th>
                <th>status</th>
                <th>duration</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.fault}>
                  <td className="mono">{r.fault}</td>
                  <td className="mono">{r.outcome}</td>
                  <td className="mono">{r.status ?? "—"}</td>
                  <td className="mono">{r.duration_ms.toFixed(1)} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
          {results.some((r) => r.err) && (
            <div style={{ marginTop: "0.75rem" }}>
              {results
                .filter((r) => r.err)
                .map((r) => (
                  <p key={r.fault} className="mono" style={{ margin: "0.25rem 0", fontSize: "0.75rem", color: "var(--muted)" }}>
                    {r.fault}: {r.err}
                  </p>
                ))}
            </div>
          )}
        </div>
      )}

      {injects.length > 0 && (
        <div className="card" style={{ marginTop: "0.75rem" }}>
          <h3>INJECTIONS · REAL</h3>
          {injects.map((e) => (
            <p key={e.id} className="mono" style={{ margin: "0.25rem 0", fontSize: "0.78rem" }}>
              {e.summary}
            </p>
          ))}
        </div>
      )}

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>
          FAILURE CLASSES <span className="badge SIMULATION">SIMULATION</span>
        </h3>
        <pre className="mono" style={{ margin: 0, color: "var(--muted)" }}>{`ok        → HTTP 200, fast
timeout   → client deadline; TCP may still be open
http 500  → TCP OK; application error status
slow      → HTTP 200; elevated latency
refused   → nothing listening (pre-HTTP)`}</pre>
      </div>
    </div>
  );
}
