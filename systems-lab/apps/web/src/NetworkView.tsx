import type { LabEvent } from "./types";

export type NetSocket = {
  state: string;
  recv_q: number;
  send_q: number;
  local_addr: string;
  local_port: number;
  peer_addr: string;
  peer_port: number;
  process?: string;
  pid?: number;
};

export type NetIface = {
  name: string;
  operstate: string;
  mtu: number;
  mac?: string;
  addrs: string[];
};

export type NetRoute = {
  dst: string;
  gateway?: string;
  dev?: string;
  metric?: number;
  prefsrc?: string;
};

export type NetSnapshot = {
  phase?: string;
  port?: number;
  host: {
    interfaces: NetIface[];
    routes: NetRoute[];
    default_dev?: string;
  };
  sockets: NetSocket[];
  ping?: { target: string; ok: boolean; latency_ms?: number; detail: string };
  note?: string;
};

type Props = {
  events: LabEvent[];
  selectedPhase: string | null;
  onSelectPhase: (phase: string) => void;
  hostIfaces: NetIface[];
  hostRoutes: NetRoute[];
  defaultDev?: string;
};

function snapFrom(e: LabEvent): NetSnapshot | null {
  const d = e.detail as { snapshot?: NetSnapshot } | undefined;
  return d?.snapshot ?? null;
}

export function NetworkView({
  events,
  selectedPhase,
  onSelectPhase,
  hostIfaces,
  hostRoutes,
  defaultDev,
}: Props) {
  const netEvents = events.filter((e) => e.kind === "network" && e.source === "REAL" && e.detail);
  const phases = netEvents
    .map((e) => {
      const snap = snapFrom(e);
      const phase = (e.detail as { phase?: string })?.phase ?? snap?.phase ?? "?";
      return { phase, event: e, snap };
    })
    .filter((p) => p.snap);

  const active = phases.find((p) => p.phase === selectedPhase) ?? phases[phases.length - 1] ?? null;
  const snap = active?.snap ?? null;
  const ifaces = snap?.host.interfaces?.length ? snap.host.interfaces : hostIfaces;
  const routes = snap?.host.routes?.length ? snap.host.routes : hostRoutes;
  const defDev = snap?.host.default_dev || defaultDev;

  return (
    <div>
      <div className="actions" style={{ flexWrap: "wrap" }}>
        {phases.length === 0 && (
          <span className="coming">No experiment samples yet — run to capture ss sockets. Host NICs below are still REAL.</span>
        )}
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
            {p.snap ? ` · ${p.snap.sockets.length} sock` : ""}
          </button>
        ))}
      </div>

      <div className="grid-2" style={{ marginTop: "0.75rem" }}>
        <div className="card">
          <h3>INTERFACES · REAL (ip -j addr)</h3>
          <table className="tools-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>State</th>
                <th>Addresses</th>
              </tr>
            </thead>
            <tbody>
              {ifaces.map((iface) => (
                <tr key={iface.name}>
                  <td className="mono">
                    {iface.name}
                    {defDev === iface.name ? " ★" : ""}
                  </td>
                  <td>{iface.operstate}</td>
                  <td className="mono" style={{ fontSize: "0.72rem" }}>
                    {(iface.addrs || []).join(", ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {defDev && (
            <p className="mono" style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
              default route via ★ {defDev}
            </p>
          )}
        </div>

        <div className="card">
          <h3>SOCKETS · REAL (ss){snap?.port ? ` · port ${snap.port}` : ""}</h3>
          {!snap && <p className="coming">Run the experiment to list LISTEN/ESTAB for the lab port.</p>}
          {snap && snap.sockets.length === 0 && (
            <p className="coming">No sockets matched this port at sample time (already closed is also REAL).</p>
          )}
          {snap && snap.sockets.length > 0 && (
            <table className="tools-table">
              <thead>
                <tr>
                  <th>State</th>
                  <th>Local</th>
                  <th>Peer</th>
                  <th>Proc</th>
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
                    <td className="mono">{s.process || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {snap?.ping && (
            <p className="mono" style={{ marginTop: "0.75rem", color: snap.ping.ok ? "var(--real)" : "var(--danger)" }}>
              ping {snap.ping.target}: {snap.ping.ok ? `ok ${snap.ping.latency_ms?.toFixed(3)} ms` : "failed"}{" "}
              <span className="badge REAL">REAL</span>
            </p>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>ROUTES · REAL (ip -j route)</h3>
        <table className="tools-table">
          <thead>
            <tr>
              <th>Dst</th>
              <th>Gateway</th>
              <th>Dev</th>
              <th>Metric</th>
            </tr>
          </thead>
          <tbody>
            {routes.slice(0, 12).map((r, i) => (
              <tr key={i}>
                <td className="mono">{r.dst}</td>
                <td className="mono">{r.gateway || "—"}</td>
                <td className="mono">{r.dev || "—"}</td>
                <td className="mono">{r.metric ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>
          STACK PATH <span className="badge SIMULATION">SIMULATION</span>
        </h3>
        <pre className="mono" style={{ margin: 0, color: "var(--muted)", lineHeight: 1.5 }}>{`Go client
  → socket (connect/send/recv)
    → TCP
      → IP
        → interface (lo for 127.0.0.1)
          → peer TCP/socket
            → Go server

This run stays on loopback. Wi-Fi/Ethernet (wlp*/enp*) carry off-host traffic.
Packet bytes need tcpdump/CAP_NET_RAW — see TOOLS (not faked here).`}</pre>
      </div>
    </div>
  );
}
