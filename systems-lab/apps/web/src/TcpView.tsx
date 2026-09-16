import type { LabEvent } from "./types";

export type TCPStep = {
  id: string;
  label: string;
  source: string;
  ss_state?: string;
  explanation?: string;
  sockets?: {
    state: string;
    local_addr: string;
    local_port: number;
    peer_addr: string;
    peer_port: number;
    send_q?: number;
    recv_q?: number;
  }[];
};

export type TCPSnapshot = {
  phase: string;
  port: number;
  client_port?: number;
  server_port?: number;
  states_seen?: string[];
  steps?: TCPStep[];
  sockets?: TCPStep["sockets"];
  note?: string;
};

type Props = {
  events: LabEvent[];
  selectedPhase: string | null;
  onSelectPhase: (phase: string) => void;
};

function snapFrom(e: LabEvent): TCPSnapshot | null {
  const d = e.detail as { snapshot?: TCPSnapshot } | undefined;
  return d?.snapshot ?? null;
}

export function TcpView({ events, selectedPhase, onSelectPhase }: Props) {
  const tcpEvents = events.filter((e) => e.kind === "tcp" && e.source === "REAL" && e.detail);
  const phases = tcpEvents
    .map((e) => {
      const snap = snapFrom(e);
      const phase = (e.detail as { phase?: string })?.phase ?? snap?.phase ?? "?";
      return { phase, event: e, snap };
    })
    .filter((p) => p.snap);

  const active = phases.find((p) => p.phase === selectedPhase) ?? phases[phases.length - 1] ?? null;
  const snap = active?.snap ?? null;
  const steps = snap?.steps ?? [];

  const handshakeSteps = steps.filter((s) =>
    ["listen", "syn", "syn_sent", "syn_recv", "estab"].includes(s.id),
  );
  const teardownSteps = steps.filter((s) =>
    ["fin-wait-1", "fin-wait-2", "close-wait", "last-ack", "time-wait", "closing"].includes(s.id),
  );

  return (
    <div>
      <div className="actions" style={{ flexWrap: "wrap" }}>
        {phases.length === 0 && <span className="coming">No TCP samples yet — run the experiment.</span>}
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
            {p.snap?.states_seen?.length ? ` · ${p.snap.states_seen.join(",")}` : ""}
          </button>
        ))}
      </div>

      {snap && (
        <div className="card" style={{ marginTop: "0.75rem" }}>
          <h3>
            ENDPOINTS · REAL
          </h3>
          <p className="mono" style={{ margin: 0, color: "var(--muted)" }}>
            server 127.0.0.1:{snap.server_port ?? snap.port}
            {snap.client_port ? ` · client ephemeral :${snap.client_port}` : ""}
          </p>
        </div>
      )}

      <div className="grid-2" style={{ marginTop: "0.75rem" }}>
        <div className="card">
          <h3>THREE-WAY HANDSHAKE</h3>
          <HandshakeDiagram steps={handshakeSteps} clientPort={snap?.client_port} serverPort={snap?.server_port ?? snap?.port} />
          <p className="mono" style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.75rem" }}>
            Packet arrows are SIMULATION unless ss shows SYN-SENT/SYN-RECV. ESTAB/LISTEN are REAL ss states.
          </p>
        </div>

        <div className="card">
          <h3>TEARDOWN (ss states)</h3>
          {teardownSteps.length === 0 && (
            <p className="coming">Run through close phases — FIN-WAIT / CLOSE-WAIT / TIME-WAIT appear in ss.</p>
          )}
          {teardownSteps.map((st) => (
            <div key={st.id} style={{ marginBottom: "0.5rem" }}>
              <span className={`badge ${st.source}`}>{st.source}</span>{" "}
              <span className="mono">{st.label}</span>
              {st.explanation && (
                <p className="mono" style={{ margin: "0.25rem 0 0", color: "var(--muted)", fontSize: "0.72rem" }}>
                  {st.explanation}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {snap && snap.sockets && snap.sockets.length > 0 && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h3>SOCKETS · REAL (ss)</h3>
          <table className="tools-table">
            <thead>
              <tr>
                <th>State</th>
                <th>Local</th>
                <th>Peer</th>
                <th>Q</th>
              </tr>
            </thead>
            <tbody>
              {snap.sockets.map((s, i) => (
                <tr key={i}>
                  <td className="mono">{s.state}</td>
                  <td className="mono">
                    {s.local_addr}:{s.local_port}
                  </td>
                  <td className="mono">
                    {s.peer_addr}:{s.peer_port || "*"}
                  </td>
                  <td className="mono">
                    r={s.recv_q ?? 0} s={s.send_q ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HandshakeDiagram({
  steps,
  clientPort,
  serverPort,
}: {
  steps: TCPStep[];
  clientPort?: number;
  serverPort?: number;
}) {
  const hasEstab = steps.some((s) => s.id === "estab" || s.ss_state === "ESTAB");
  const hasListen = steps.some((s) => s.id === "listen" || s.ss_state === "LISTEN");
  const hasSynReal = steps.some((s) => s.ss_state === "SYN-SENT" || s.ss_state === "SYN-RECV");
  const synSim = steps.some((s) => s.id === "syn" && s.source === "SIMULATION");

  return (
    <svg viewBox="0 0 640 220" className="map-svg" style={{ minHeight: 220 }}>
      <text className="label" x="80" y="30" textAnchor="middle">
        CLIENT
      </text>
      <text className="sub" x="80" y="48" textAnchor="middle">
        {clientPort ? `:${clientPort}` : "ephemeral"}
      </text>
      <line x1="80" y1="55" x2="80" y2="190" stroke="var(--border)" strokeWidth="2" />

      <text className="label" x="560" y="30" textAnchor="middle">
        SERVER
      </text>
      <text className="sub" x="560" y="48" textAnchor="middle">
        {serverPort ? `:${serverPort}` : "listen"}
      </text>
      <line x1="560" y1="55" x2="560" y2="190" stroke="var(--border)" strokeWidth="2" />

      {hasListen && (
        <>
          <text className="sub" x="560" y="72" textAnchor="middle">
            LISTEN
          </text>
          <text className="sub" x="560" y="86" textAnchor="middle">
            <tspan fill="var(--real)">REAL</tspan>
          </text>
        </>
      )}

      {(hasSynReal || synSim) && (
        <>
          <line className="edge pulse" x1="80" y1="105" x2="560" y2="125" />
          <text className="sub" x="320" y="100" textAnchor="middle">
            SYN {hasSynReal ? "(REAL ss)" : "(SIMULATION)"}
          </text>
          <line className="edge pulse" x1="560" y1="135" x2="80" y2="155" />
          <text className="sub" x="320" y="150" textAnchor="middle">
            SYN-ACK {hasSynReal ? "(REAL ss)" : "(SIMULATION)"}
          </text>
          <line className="edge pulse" x1="80" y1="165" x2="560" y2="175" />
          <text className="sub" x="320" y="180" textAnchor="middle">
            ACK {hasSynReal ? "(REAL ss)" : "(SIMULATION)"}
          </text>
        </>
      )}

      {hasEstab && (
        <text className="label" x="320" y="205" textAnchor="middle" fill="var(--real)">
          ESTABLISHED (REAL ss)
        </text>
      )}

      {!hasListen && !hasEstab && steps.length === 0 && (
        <text className="sub" x="320" y="120" textAnchor="middle">
          Run experiment to populate handshake
        </text>
      )}
    </svg>
  );
}
