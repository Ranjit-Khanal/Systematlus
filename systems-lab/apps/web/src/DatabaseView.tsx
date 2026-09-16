import type { LabEvent } from "./types";

type DbDetail = {
  driver?: string;
  path?: string;
  file_bytes?: number;
  status?: string;
  proto?: string;
  bytes?: number;
  timing_ms?: Record<string, number>;
  queries?: { sql: string; duration_ms: number; rows: number }[];
  pool?: Record<string, number>;
  handler_db_ms?: number;
  port?: number;
};

type Props = { events: LabEvent[] };

function latestSummary(events: LabEvent[]): DbDetail | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.kind === "database" && e.source === "REAL" && e.explain_key === "db.response") {
      return (e.detail as DbDetail) ?? null;
    }
  }
  return null;
}

export function DatabaseView({ events }: Props) {
  const dbEvents = events.filter((e) => e.experiment === "database" && e.source === "REAL");
  const summary = latestSummary(dbEvents);
  const execs = dbEvents.filter((e) => e.explain_key === "db.exec");
  const handlers = dbEvents.filter((e) => e.summary.startsWith("HANDLER_"));

  return (
    <div>
      {!summary && <p className="coming">Run the experiment to capture a REAL HTTP + SQLite exchange.</p>}

      {summary && (
        <>
          <div className="grid-2">
            <div className="card">
              <h3>DATABASE · REAL</h3>
              <table className="tools-table">
                <tbody>
                  <tr>
                    <td>driver</td>
                    <td className="mono">{summary.driver ?? "—"}</td>
                  </tr>
                  <tr>
                    <td>file</td>
                    <td className="mono" style={{ wordBreak: "break-all" }}>
                      {summary.path ?? "—"}
                    </td>
                  </tr>
                  <tr>
                    <td>file size</td>
                    <td className="mono">{summary.file_bytes ?? 0} bytes</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="card">
              <h3>HTTP · REAL</h3>
              <pre className="mono" style={{ margin: 0, fontSize: "0.78rem" }}>
                {`GET /api/users HTTP/1.1\n→ ${summary.status ?? "?"} ${summary.proto ?? ""}\n${summary.bytes ?? 0} bytes`}
              </pre>
            </div>
          </div>

          <div className="card" style={{ marginTop: "0.75rem" }}>
            <h3>QUERIES · REAL</h3>
            {(summary.queries ?? []).length === 0 && <p className="coming">No query events.</p>}
            <table className="tools-table">
              <thead>
                <tr>
                  <th>SQL</th>
                  <th>rows</th>
                  <th>duration</th>
                </tr>
              </thead>
              <tbody>
                {(summary.queries ?? []).map((q) => (
                  <tr key={q.sql}>
                    <td className="mono">{q.sql}</td>
                    <td className="mono">{q.rows}</td>
                    <td className="mono">{q.duration_ms.toFixed(3)} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid-2" style={{ marginTop: "0.75rem" }}>
            <div className="card">
              <h3>TIMING · REAL / DERIVED</h3>
              <table className="tools-table">
                <tbody>
                  {summary.handler_db_ms != null && (
                    <tr>
                      <td className="mono">handler_db_ms</td>
                      <td className="mono">{summary.handler_db_ms.toFixed(3)} ms</td>
                    </tr>
                  )}
                  {Object.entries(summary.timing_ms ?? {}).map(([k, v]) => (
                    <tr key={k}>
                      <td className="mono">{k}</td>
                      <td className="mono">{v.toFixed(3)} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card">
              <h3>POOL · REAL</h3>
              {!summary.pool && <p className="coming">No pool stats.</p>}
              {summary.pool && (
                <table className="tools-table">
                  <tbody>
                    {Object.entries(summary.pool).map(([k, v]) => (
                      <tr key={k}>
                        <td className="mono">{k}</td>
                        <td className="mono">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {execs.length > 0 && (
            <div className="card" style={{ marginTop: "0.75rem" }}>
              <h3>SETUP · REAL</h3>
              {execs.map((e) => (
                <p key={e.id} className="mono" style={{ margin: "0.25rem 0", fontSize: "0.78rem" }}>
                  {e.summary}
                </p>
              ))}
            </div>
          )}

          {handlers.length > 0 && (
            <div className="card" style={{ marginTop: "0.75rem" }}>
              <h3>HANDLER · REAL</h3>
              {handlers.map((h) => (
                <p key={h.id} className="mono" style={{ margin: "0.25rem 0", fontSize: "0.78rem" }}>
                  {h.summary}
                </p>
              ))}
            </div>
          )}
        </>
      )}

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>
          STACK <span className="badge SIMULATION">SIMULATION</span>
        </h3>
        <pre className="mono" style={{ margin: 0, color: "var(--muted)" }}>{`http.Client GET /api/users
  → net/http handler
    → database/sql.Query
      → modernc.org/sqlite driver
        → VFS read/write (.sqlite file on disk)`}</pre>
      </div>
    </div>
  );
}
