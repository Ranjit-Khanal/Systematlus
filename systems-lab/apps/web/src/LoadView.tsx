import type { LabEvent } from "./types";

type LoadDetail = {
  n?: number;
  concurrency?: number;
  ok?: number;
  err?: number;
  handled?: number;
  wall_ms?: number;
  rps?: number;
  latency_ms?: Record<string, number>;
  peak_sockets?: number;
  port?: number;
};

type Props = { events: LabEvent[] };

function latestSummary(events: LabEvent[]): LoadDetail | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.kind === "load" && e.explain_key === "load.summary") {
      return (e.detail as LoadDetail) ?? null;
    }
  }
  return null;
}

export function LoadView({ events }: Props) {
  const loadEvents = events.filter((e) => e.experiment === "load");
  const summary = latestSummary(loadEvents);
  const samples = loadEvents.filter((e) => e.summary.startsWith("LOAD_SAMPLE") && e.source === "REAL");
  const lat = summary?.latency_ms ?? {};

  return (
    <div>
      {!summary && <p className="coming">Run the experiment to measure REAL concurrent request latencies.</p>}

      {summary && (
        <>
          <div className="grid-2">
            <div className="card">
              <h3>CONFIG · REAL</h3>
              <table className="tools-table">
                <tbody>
                  <tr>
                    <td>requests</td>
                    <td className="mono">{summary.n ?? "—"}</td>
                  </tr>
                  <tr>
                    <td>concurrency</td>
                    <td className="mono">{summary.concurrency ?? "—"}</td>
                  </tr>
                  <tr>
                    <td>wall</td>
                    <td className="mono">{(summary.wall_ms ?? 0).toFixed(1)} ms</td>
                  </tr>
                  <tr>
                    <td>peak sockets (ss)</td>
                    <td className="mono">{summary.peak_sockets ?? 0}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="card">
              <h3>OUTCOMES · REAL</h3>
              <table className="tools-table">
                <tbody>
                  <tr>
                    <td>ok</td>
                    <td className="mono ok">{summary.ok ?? 0}</td>
                  </tr>
                  <tr>
                    <td>err</td>
                    <td className="mono">{summary.err ?? 0}</td>
                  </tr>
                  <tr>
                    <td>handler count</td>
                    <td className="mono">{summary.handled ?? 0}</td>
                  </tr>
                  <tr>
                    <td>throughput</td>
                    <td className="mono">{(summary.rps ?? 0).toFixed(1)} rps</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ marginTop: "0.75rem" }}>
            <h3>LATENCY · DERIVED from REAL timings</h3>
            <table className="tools-table">
              <tbody>
                {["avg_ms", "p50_ms", "p95_ms", "p99_ms", "max_ms"].map((k) => (
                  <tr key={k}>
                    <td className="mono">{k}</td>
                    <td className="mono">{(lat[k] ?? 0).toFixed(3)} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {samples.length > 0 && (
            <div className="card" style={{ marginTop: "0.75rem" }}>
              <h3>SAMPLES · REAL</h3>
              {samples.map((e) => (
                <p key={e.id} className="mono" style={{ margin: "0.25rem 0", fontSize: "0.78rem" }}>
                  {e.summary}
                </p>
              ))}
            </div>
          )}
        </>
      )}

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>
          MODEL <span className="badge SIMULATION">SIMULATION</span>
        </h3>
        <pre className="mono" style={{ margin: 0, color: "var(--muted)" }}>{`N clients × C workers
  → overlapping TCP connections
    → handler queueing
      → latency distribution (p50 << p99 under load)`}</pre>
      </div>
    </div>
  );
}
