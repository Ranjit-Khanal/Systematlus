import type { LabEvent } from "./types";

export type DNSRecord = { name: string; type: string; value: string; ttl?: number };
export type DNSResult = {
  domain: string;
  nameservers: string[];
  records: DNSRecord[];
  latency_ms: number;
  method: string;
  resolver_note?: string;
  error?: string;
};

type Props = { events: LabEvent[]; domain: string; onDomainChange: (d: string) => void };

function resultFrom(events: LabEvent[]): DNSResult | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.kind !== "dns" || e.source !== "REAL") continue;
    const r = (e.detail as { result?: DNSResult })?.result;
    if (r) return r;
  }
  return null;
}

export function DnsView({ events, domain, onDomainChange }: Props) {
  const dnsEvents = events.filter((e) => e.experiment === "dns");
  const res = resultFrom(dnsEvents);

  return (
    <div>
      <div className="actions">
        <input
          className="mono"
          style={{
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: "var(--text)",
            padding: "0.4rem 0.6rem",
            borderRadius: 4,
            minWidth: 220,
          }}
          value={domain}
          onChange={(e) => onDomainChange(e.target.value)}
          placeholder="example.com"
        />
      </div>

      {!res && <p className="coming">Run a lookup to see REAL resolver output.</p>}

      {res && (
        <div className="grid-2" style={{ marginTop: "0.75rem" }}>
          <div className="card">
            <h3>RESOLVER · REAL</h3>
            <p className="mono" style={{ margin: 0, color: "var(--muted)" }}>
              domain={res.domain}
              <br />
              latency={res.latency_ms.toFixed(2)} ms
              <br />
              method={res.method}
            </p>
            <p className="mono" style={{ marginTop: "0.75rem", fontSize: "0.72rem", color: "var(--muted)" }}>
              nameservers: {res.nameservers.join(", ") || "—"}
            </p>
          </div>
          <div className="card">
            <h3>RECORDS · REAL</h3>
            <table className="tools-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Value</th>
                  <th>TTL</th>
                </tr>
              </thead>
              <tbody>
                {res.records.map((rec, i) => (
                  <tr key={i}>
                    <td className="mono">{rec.type}</td>
                    <td className="mono">{rec.value}</td>
                    <td className="mono">{rec.ttl || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>
          PATH <span className="badge SIMULATION">SIMULATION</span>
        </h3>
        <pre className="mono" style={{ margin: 0, color: "var(--muted)" }}>{`Application
  → Go net.Resolver / libc
    → OS resolver (systemd-resolved / resolv.conf)
      → DNS server (UDP/TCP 53)
        → A / AAAA records
          → TCP connect to IP`}</pre>
      </div>
    </div>
  );
}
