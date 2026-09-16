import type { LabEvent } from "./types";

type HttpDetail = {
  status?: string;
  proto?: string;
  bytes?: number;
  headers?: Record<string, string>;
  timing_ms?: Record<string, number>;
  port?: number;
};

type Props = { events: LabEvent[] };

function latestSummary(events: LabEvent[]): HttpDetail | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.kind === "http" && e.source === "REAL" && e.explain_key === "http.response") {
      return (e.detail as HttpDetail) ?? null;
    }
  }
  return null;
}

export function HttpView({ events }: Props) {
  const httpEvents = events.filter((e) => e.experiment === "http" && e.source === "REAL");
  const summary = latestSummary(httpEvents);
  const handlers = httpEvents.filter((e) => e.summary.startsWith("HANDLER_"));

  return (
    <div>
      {!summary && <p className="coming">Run the experiment to capture a REAL HTTP exchange.</p>}

      {summary && (
        <>
          <div className="card">
            <h3>REQUEST / RESPONSE · REAL</h3>
            <pre className="mono" style={{ margin: 0, color: "var(--accent)" }}>
              {`GET /api/users HTTP/1.1\nHost: 127.0.0.1:${summary.port ?? "?"}\nUser-Agent: systems-lab/1.0\nAccept: application/json`}
            </pre>
            <pre className="mono" style={{ margin: "1rem 0 0", color: "var(--real)" }}>
              {`HTTP/1.1 ${summary.status ?? "?"}\n${Object.entries(summary.headers ?? {})
                .map(([k, v]) => `${k}: ${v}`)
                .join("\n")}\n\n{... ${summary.bytes ?? 0} bytes ...}`}
            </pre>
          </div>

          <div className="grid-2" style={{ marginTop: "0.75rem" }}>
            <div className="card">
              <h3>TIMING · REAL / DERIVED</h3>
              <table className="tools-table">
                <tbody>
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
              <h3>HANDLER · REAL</h3>
              {handlers.length === 0 && <p className="coming">No handler events.</p>}
              {handlers.map((h) => (
                <p key={h.id} className="mono" style={{ margin: "0.25rem 0", fontSize: "0.78rem" }}>
                  {h.summary}
                </p>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>
          STACK <span className="badge SIMULATION">SIMULATION</span>
        </h3>
        <pre className="mono" style={{ margin: 0, color: "var(--muted)" }}>{`Client (http.Client)
  → TCP (127.0.0.1)
    → net/http server
      → ServeMux
        → handler func
          → ResponseWriter headers + body`}</pre>
      </div>
    </div>
  );
}
