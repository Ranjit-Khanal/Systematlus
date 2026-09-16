import type { LabEvent } from "./types";

type Step = {
  layer?: string;
  action?: string;
  duration_ms?: number;
  raw?: string;
  status?: string;
  rows?: number;
  bytes?: number;
};

type Summary = {
  domain?: string;
  status?: string;
  dns_ms?: number;
  tcp_ms?: number;
  http_ms?: number;
  db_ms?: number;
  total_ms?: number;
};

type Props = { events: LabEvent[] };

const LAYER_COLOR: Record<string, string> = {
  dns: "var(--accent)",
  tcp: "var(--real)",
  http: "#8bc4ff",
  db: "#c9a227",
};

function latestSummary(events: LabEvent[]): { steps: Step[]; timing: Record<string, number>; summary: Summary } | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.kind === "e2e" && e.explain_key === "e2e.summary" && e.source === "REAL") {
      const d = e.detail as {
        steps?: Step[];
        timing_ms?: Record<string, number>;
        summary?: Summary;
      };
      return {
        steps: d.steps ?? [],
        timing: d.timing_ms ?? {},
        summary: (d.summary as Summary) ?? {},
      };
    }
  }
  return null;
}

export function E2EView({ events }: Props) {
  const e2eEvents = events.filter((e) => e.experiment === "e2e");
  const data = latestSummary(e2eEvents);
  const steps = data?.steps ?? [];
  const timing = data?.timing ?? {};
  const summary = data?.summary ?? {};

  const maxMs = Math.max(
    timing.total_ms ?? 0,
    (timing.dns_ms ?? 0) + (timing.tcp_ms ?? 0) + (timing.http_ms ?? 0) + (timing.db_ms ?? 0),
    1,
  );

  return (
    <div>
      {!data && <p className="coming">Press SEND REQUEST to run a cross-layer GET /api/users.</p>}

      {data && (
        <>
          <div className="card">
            <h3>REQUEST · REAL</h3>
            <pre className="mono" style={{ margin: 0, fontSize: "0.85rem" }}>
              {`GET /api/users\nHost: ${summary.domain ?? "localhost"}\n→ HTTP ${summary.status ?? "?"} · total ${(timing.total_ms ?? summary.total_ms ?? 0).toFixed(2)} ms`}
            </pre>
          </div>

          <div className="card" style={{ marginTop: "0.75rem" }}>
            <h3>CROSS-LAYER TIMELINE · REAL</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {steps.map((s, i) => {
                const dur = s.duration_ms ?? 0;
                const pct = Math.max(4, (dur / maxMs) * 100);
                const layer = s.layer ?? "?";
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span className="mono" style={{ width: "3rem", fontSize: "0.75rem", color: LAYER_COLOR[layer] ?? "var(--muted)" }}>
                      {layer}
                    </span>
                    <div style={{ flex: 1, background: "var(--panel2, #1a2030)", borderRadius: 4, height: 28, position: "relative" }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background: LAYER_COLOR[layer] ?? "var(--accent)",
                          borderRadius: 4,
                          opacity: 0.85,
                        }}
                      />
                      <span
                        className="mono"
                        style={{
                          position: "absolute",
                          left: 8,
                          top: 6,
                          fontSize: "0.72rem",
                          color: "#fff",
                        }}
                      >
                        {s.action} · {dur.toFixed(2)} ms
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid-2" style={{ marginTop: "0.75rem" }}>
            <div className="card">
              <h3>TIMING · REAL / DERIVED</h3>
              <table className="tools-table">
                <tbody>
                  {["dns_ms", "tcp_ms", "http_ms", "db_ms", "total_ms"].map((k) => (
                    <tr key={k}>
                      <td className="mono">{k}</td>
                      <td className="mono">{((timing[k] ?? (summary as Record<string, number>)[k]) ?? 0).toFixed(3)} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card">
              <h3>EVENTS · REAL</h3>
              <p style={{ margin: 0, fontSize: "0.85rem" }}>
                {e2eEvents.filter((e) => e.source === "REAL").length} REAL events in this run
              </p>
              <p style={{ margin: "0.5rem 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>
                Filter timeline by experiment=<code>e2e</code> or kind dns/tcp/http/database.
              </p>
            </div>
          </div>
        </>
      )}

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>
          FULL STACK <span className="badge SIMULATION">SIMULATION</span>
        </h3>
        <pre className="mono" style={{ margin: 0, color: "var(--muted)" }}>{`Client
  → DNS (localhost → 127.0.0.1)
    → TCP connect
      → HTTP GET /api/users
        → handler
          → SQLite SELECT
            → JSON response`}</pre>
      </div>
    </div>
  );
}
