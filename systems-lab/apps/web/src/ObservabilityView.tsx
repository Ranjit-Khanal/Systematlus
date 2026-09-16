import { useCallback, useEffect, useState } from "react";
import { api, type ObservabilitySnapshot } from "./api";
import type { LabEvent } from "./types";

type Props = { events: LabEvent[] };

function fmtKB(kb: number) {
  if (kb >= 1024 * 1024) return `${(kb / 1024 / 1024).toFixed(1)} GiB`;
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MiB`;
  return `${kb} KiB`;
}

function fmtUptime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

export function ObservabilityView({ events }: Props) {
  const [snap, setSnap] = useState<ObservabilitySnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async (publish?: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      const r = publish ? await api.refreshObservability() : await api.observability();
      setSnap(r.snapshot);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    refresh(false).catch(() => undefined);
  }, [refresh]);

  const obsEvents = events.filter((e) => e.experiment === "observability" || e.kind === "observability");
  const lastRefresh = [...obsEvents].reverse().find((e) => e.explain_key === "obs.snapshot");

  return (
    <div>
      <div className="actions" style={{ marginBottom: "0.75rem" }}>
        <button className="btn" disabled={busy} onClick={() => refresh(false)}>
          {busy ? "Collecting…" : "Refresh snapshot"}
        </button>
        <button className="btn" disabled={busy} onClick={() => refresh(true)}>
          Refresh + publish event
        </button>
      </div>
      {err && <p className="bad">{err}</p>}

      {!snap && !err && <p className="coming">Loading observability snapshot…</p>}

      {snap && (
        <>
          <p className="mono" style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0 0 0.75rem" }}>
            collected {snap.collected_at} · source {snap.source}
          </p>

          <div className="grid-2">
            <div className="card">
              <h3>HOST · REAL</h3>
              <table className="tools-table">
                <tbody>
                  <tr>
                    <td>hostname</td>
                    <td className="mono">{snap.host.hostname}</td>
                  </tr>
                  <tr>
                    <td>kernel</td>
                    <td className="mono">{snap.host.kernel_release}</td>
                  </tr>
                  <tr>
                    <td>cpus</td>
                    <td className="mono">{snap.host.cpus}</td>
                  </tr>
                  <tr>
                    <td>memory</td>
                    <td className="mono">
                      {fmtKB(Number(snap.host.mem_available_kb))} / {fmtKB(Number(snap.host.mem_total_kb))} avail
                    </td>
                  </tr>
                  <tr>
                    <td>uptime</td>
                    <td className="mono">{fmtUptime(snap.host.uptime_sec)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="card">
              <h3>TOOLS · REAL</h3>
              <p style={{ margin: "0 0 0.5rem" }}>
                <span className="ok">{snap.tools_usable}</span> / {snap.tools_total} usable
              </p>
              <table className="tools-table">
                <tbody>
                  {snap.tools.map((t) => (
                    <tr key={t.name}>
                      <td className="mono">{t.name}</td>
                      <td className={t.usable ? "ok" : "bad"}>{t.usable ? "yes" : "no"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid-2" style={{ marginTop: "0.75rem" }}>
            <div className="card">
              <h3>NETWORK · REAL</h3>
              {snap.network_err && <p className="bad">{snap.network_err}</p>}
              {!snap.network_err && (
                <table className="tools-table">
                  <tbody>
                    <tr>
                      <td>interfaces</td>
                      <td className="mono">{snap.network.interfaces?.length ?? 0}</td>
                    </tr>
                    <tr>
                      <td>routes</td>
                      <td className="mono">{snap.network.routes?.length ?? 0}</td>
                    </tr>
                    <tr>
                      <td>default dev</td>
                      <td className="mono">{snap.network.default_dev ?? "—"}</td>
                    </tr>
                    <tr>
                      <td>tcpdump</td>
                      <td className={snap.capture.usable ? "ok" : "bad"}>
                        {snap.capture.usable ? "usable" : snap.capture.detail}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            <div className="card">
              <h3>TCP SOCKETS · REAL</h3>
              {snap.tcp_err && <p className="bad">{snap.tcp_err}</p>}
              {!snap.tcp_err && (
                <>
                  <p style={{ margin: "0 0 0.5rem" }}>total: {snap.tcp.total}</p>
                  <table className="tools-table">
                    <tbody>
                      {Object.entries(snap.tcp.by_state ?? {}).map(([st, n]) => (
                        <tr key={st}>
                          <td className="mono">{st}</td>
                          <td className="mono">{n}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>

          <div className="card" style={{ marginTop: "0.75rem" }}>
            <h3>EVENT RING · REAL</h3>
            <table className="tools-table">
              <tbody>
                <tr>
                  <td>events in ring</td>
                  <td className="mono">{snap.events.total}</td>
                </tr>
                <tr>
                  <td>REAL / SIMULATION / DERIVED</td>
                  <td className="mono">
                    {snap.events.by_source?.REAL ?? 0} / {snap.events.by_source?.SIMULATION ?? 0} /{" "}
                    {snap.events.by_source?.DERIVED ?? 0}
                  </td>
                </tr>
                <tr>
                  <td>last experiment</td>
                  <td className="mono">{snap.events.last_experiment ?? "—"}</td>
                </tr>
                <tr>
                  <td>last event</td>
                  <td className="mono">
                    {snap.events.last_event_kind ?? "—"} @ {snap.events.last_event_ts?.slice(0, 19) ?? "—"}
                  </td>
                </tr>
              </tbody>
            </table>
            {Object.keys(snap.events.by_experiment ?? {}).length > 0 && (
              <div style={{ marginTop: "0.75rem" }}>
                <h4 style={{ margin: "0 0 0.35rem", fontSize: "0.85rem" }}>by experiment</h4>
                <table className="tools-table">
                  <tbody>
                    {Object.entries(snap.events.by_experiment ?? {}).map(([exp, n]) => (
                      <tr key={exp}>
                        <td className="mono">{exp}</td>
                        <td className="mono">{n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {lastRefresh && (
            <div className="card" style={{ marginTop: "0.75rem" }}>
              <h3>LAST PUBLISHED REFRESH · REAL</h3>
              <p className="mono" style={{ margin: 0, fontSize: "0.78rem" }}>
                {lastRefresh.summary}
              </p>
            </div>
          )}
        </>
      )}

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>
          MODEL <span className="badge SIMULATION">SIMULATION</span>
        </h3>
        <pre className="mono" style={{ margin: 0, color: "var(--muted)" }}>{`/proc + ip + ss + tools probe + event hub
  → single snapshot API
    → dashboard cards (all REAL except this diagram)`}</pre>
      </div>
    </div>
  );
}
