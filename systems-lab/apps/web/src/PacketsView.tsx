import type { LabEvent } from "./types";

type Cap = {
  present?: boolean;
  usable?: boolean;
  path?: string;
  detail?: string;
  install_hint?: string;
  blocked_reason?: string;
};

type PacketRow = {
  raw?: string;
  src?: string;
  dst?: string;
  flags?: string;
  length?: number;
  proto?: string;
  summary?: string;
};

type SimStep = { step: number; dir: string; flags: string; label: string; note: string };

type Props = { events: LabEvent[]; tools: { name: string; usable: boolean; detail: string; install_hint?: string }[] };

function latestByKey(events: LabEvent[], key: string): LabEvent | null {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].explain_key === key) return events[i];
  }
  return null;
}

export function PacketsView({ events, tools }: Props) {
  const pktEvents = events.filter((e) => e.experiment === "packets");
  const capEvt = latestByKey(pktEvents, "packet.capability");
  const blocked = latestByKey(pktEvents, "packet.blocked");
  const summary = latestByKey(pktEvents, "packet.summary");
  const sim = latestByKey(pktEvents, "packet.simulation");
  const lines = pktEvents.filter((e) => e.explain_key === "packet.line" && e.source === "REAL");
  const cap = (capEvt?.detail as Cap) ?? {};
  const tcpdumpTool = tools.find((t) => t.name === "tcpdump");

  const packets = (summary?.detail?.packets as PacketRow[] | undefined) ?? [];
  const steps = (sim?.detail?.steps as SimStep[] | undefined) ?? [];
  const mode = (summary?.detail?.mode as string) ?? (blocked ? "blocked" : null);

  return (
    <div>
      <div className="card">
        <h3>CAPTURE CAPABILITY · REAL</h3>
        {!capEvt && !tcpdumpTool && <p className="coming">Run the experiment to probe tcpdump.</p>}
        {(capEvt || tcpdumpTool) && (
          <table className="tools-table">
            <tbody>
              <tr>
                <td>tcpdump</td>
                <td className={cap.usable ?? tcpdumpTool?.usable ? "ok" : "bad"}>
                  {(cap.usable ?? tcpdumpTool?.usable) ? "usable" : "blocked / missing"}
                </td>
              </tr>
              <tr>
                <td>detail</td>
                <td>{cap.detail ?? tcpdumpTool?.detail ?? "—"}</td>
              </tr>
              {!(cap.usable ?? tcpdumpTool?.usable) && (
                <tr>
                  <td>fix</td>
                  <td className="mono">{cap.install_hint ?? tcpdumpTool?.install_hint ?? "—"}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {!capEvt && !summary && !blocked && (
        <p className="coming" style={{ marginTop: "1rem" }}>
          Run the experiment. A TCP exchange always runs; packet lines appear only if capture is allowed.
        </p>
      )}

      {mode === "capture" && (
        <div className="card" style={{ marginTop: "0.75rem" }}>
          <h3>PACKETS · REAL (tcpdump)</h3>
          {packets.length === 0 && lines.length === 0 && (
            <p className="coming">Capture started but no frames matched the filter.</p>
          )}
          <table className="tools-table">
            <thead>
              <tr>
                <th>flags</th>
                <th>src → dst</th>
                <th>len</th>
              </tr>
            </thead>
            <tbody>
              {(packets.length > 0 ? packets : lines.map((e) => e.detail as PacketRow)).map((p, i) => (
                <tr key={i}>
                  <td className="mono">{p.flags ?? "—"}</td>
                  <td className="mono">
                    {p.src ?? "?"} → {p.dst ?? "?"}
                  </td>
                  <td className="mono">{p.length ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {blocked && (
        <>
          <div className="card" style={{ marginTop: "0.75rem" }}>
            <h3>STATUS · REAL</h3>
            <p style={{ margin: 0, color: "var(--bad, #c44)" }}>{blocked.summary}</p>
            <p className="mono" style={{ marginTop: "0.5rem", fontSize: "0.78rem" }}>
              {(blocked.detail as { install_hint?: string })?.install_hint}
            </p>
            <p style={{ marginTop: "0.75rem", color: "var(--muted)", fontSize: "0.85rem" }}>
              Socket states during the TCP exchange still come from <code>ss</code> (REAL). Individual frame bytes are
              not invented.
            </p>
          </div>

          {steps.length > 0 && (
            <div className="card" style={{ marginTop: "0.75rem" }}>
              <h3>
                EXPECTED SEQUENCE <span className="badge SIMULATION">SIMULATION</span>
              </h3>
              <table className="tools-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>dir</th>
                    <th>flags</th>
                    <th>label</th>
                    <th>note</th>
                  </tr>
                </thead>
                <tbody>
                  {steps.map((s) => (
                    <tr key={s.step}>
                      <td className="mono">{s.step}</td>
                      <td className="mono">{s.dir}</td>
                      <td className="mono">[{s.flags}]</td>
                      <td>{s.label}</td>
                      <td style={{ color: "var(--muted)" }}>{s.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>
          LAYER <span className="badge SIMULATION">SIMULATION</span>
        </h3>
        <pre className="mono" style={{ margin: 0, color: "var(--muted)" }}>{`Application write()
  → TCP segment
    → IP packet
      → Ethernet / loopback
        → tcpdump (needs CAP_NET_RAW)`}</pre>
      </div>
    </div>
  );
}
