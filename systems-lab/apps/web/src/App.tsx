import { useEffect, useState } from "react";
import { api } from "./api";
import { DatabaseView } from "./DatabaseView";
import { DnsView } from "./DnsView";
import { E2EView } from "./E2EView";
import { FailuresView } from "./FailuresView";
import { HttpView } from "./HttpView";
import { LearningPane } from "./LearningPane";
import { LoadView } from "./LoadView";
import { MemoryView } from "./MemoryView";
import { NetworkView, type NetIface, type NetRoute } from "./NetworkView";
import { ObservabilityView } from "./ObservabilityView";
import { PacketsView } from "./PacketsView";
import { PostgresInternalsView } from "./PostgresInternalsView";
import { SystemMap } from "./SystemMap";
import { TcpView } from "./TcpView";
import { ThreadsView } from "./ThreadsView";
import { Timeline } from "./Timeline";
import { NAV, type HostInfo, type LabEvent, type NavId, type ToolStatus } from "./types";
import { useLabEvents } from "./useLabEvents";

type RunKind =
  | "process"
  | "syscalls"
  | "memory"
  | "scheduler"
  | "network"
  | "tcp"
  | "dns"
  | "http"
  | "database"
  | "packets"
  | "failures"
  | "load"
  | "e2e";

const NAV_FOR: Record<RunKind, NavId> = {
  process: "processes",
  syscalls: "syscalls",
  memory: "memory",
  scheduler: "cpu",
  network: "network",
  tcp: "tcp",
  dns: "dns",
  http: "http",
  database: "database",
  packets: "packets",
  failures: "failures",
  load: "load",
  e2e: "e2e",
};

export default function App() {
  const { events, connected, clear } = useLabEvents();
  const [nav, setNav] = useState<NavId>("map");
  const [selected, setSelected] = useState<LabEvent | null>(null);
  const [layer, setLayer] = useState<string | null>(null);
  const [host, setHost] = useState<HostInfo | null>(null);
  const [tools, setTools] = useState<ToolStatus[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [procView, setProcView] = useState<string>("");
  const [memPhase, setMemPhase] = useState<string | null>(null);
  const [schedPhase, setSchedPhase] = useState<string | null>(null);
  const [netPhase, setNetPhase] = useState<string | null>(null);
  const [tcpPhase, setTcpPhase] = useState<string | null>(null);
  const [dnsDomain, setDnsDomain] = useState("example.com");
  const [netIfaces, setNetIfaces] = useState<NetIface[]>([]);
  const [netRoutes, setNetRoutes] = useState<NetRoute[]>([]);
  const [defaultDev, setDefaultDev] = useState<string | undefined>();

  useEffect(() => {
    api.host().then((r) => setHost(r.host)).catch(() => undefined);
    api.tools().then((r) => setTools(r.tools)).catch(() => undefined);
    api
      .networkHost()
      .then((r) => {
        setNetIfaces(r.host.interfaces as NetIface[]);
        setNetRoutes(r.host.routes as NetRoute[]);
        setDefaultDev(r.host.default_dev);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (selected?.layer) setLayer(selected.layer);
    if (selected?.detail && typeof selected.detail === "object") {
      const phase = (selected.detail as { phase?: string }).phase;
      if (!phase) return;
      if (selected.kind === "memory") setMemPhase(phase);
      if (selected.kind === "thread") setSchedPhase(phase);
      if (selected.kind === "network") setNetPhase(phase);
      if (selected.kind === "tcp") setTcpPhase(phase);
    }
  }, [selected]);

  const run = async (kind: RunKind) => {
    setBusy(true);
    setErr(null);
    setSelected(null);
    try {
      if (kind === "process") await api.runProcess();
      else if (kind === "syscalls") await api.runSyscalls();
      else if (kind === "memory") await api.runMemory();
      else if (kind === "scheduler") await api.runScheduler();
      else if (kind === "network") await api.runNetwork();
      else if (kind === "tcp") await api.runTCP();
      else if (kind === "dns") await api.runDNS(dnsDomain);
      else if (kind === "http") await api.runHTTP();
      else if (kind === "database") await api.runDatabase();
      else if (kind === "packets") await api.runPackets();
      else if (kind === "failures") await api.runFailures();
      else if (kind === "load") await api.runLoad();
      else await api.runE2E();
      setNav(NAV_FOR[kind]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const inspectLatestPid = async () => {
    const procEvt = [...events].reverse().find((e) => e.pid);
    if (!procEvt?.pid) {
      setErr("No event with a PID yet — run an experiment first.");
      return;
    }
    try {
      const r = await api.proc(procEvt.pid);
      setProcView(JSON.stringify(r, null, 2));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const processEvents = events.filter(
    (e) => e.kind === "process" || (e.experiment === "processes" && e.kind !== "map_pulse"),
  );
  const parents = processEvents.filter((e) => e.detail && (e.detail as { role?: string }).role === "parent");
  const children = processEvents.filter((e) => e.detail && (e.detail as { role?: string }).role === "child");

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          COMPUTER SYSTEMS <span>LAB</span>
        </div>
        <div
          className={`ws-dot${connected ? " on" : ""}`}
          title={connected ? "WebSocket connected" : "WebSocket disconnected"}
        />
        <div className="host-pill">
          {host
            ? `${host.hostname} · Linux ${host.kernel_release} · ${host.cpus} CPUs · ${(host.mem_total_kb / 1024 / 1024).toFixed(1)} GiB`
            : "connecting to agent…"}
        </div>
      </header>

      <nav className="nav">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={nav === item.id ? "active" : ""}
            disabled={!item.ready}
            onClick={() => setNav(item.id)}
          >
            {item.label}
            {!item.ready ? " · soon" : ""}
          </button>
        ))}
      </nav>

      <main className="main">
        <div className="panel">
          {err && <p className="mono bad">{err}</p>}

          {nav === "map" && (
            <>
              <h1>System Map</h1>
              <p className="lede">
                REAL measurements feed the timeline; glowing arrows are SIMULATION cues.
              </p>
              <div className="actions">
                <button className="btn" disabled={busy} onClick={() => run("e2e")}>
                  {busy ? "Sending…" : "SEND REQUEST — E2E"}
                </button>
                <button className="btn" disabled={busy} onClick={() => run("process")}>
                  Process
                </button>
                <button className="btn" disabled={busy} onClick={() => run("syscalls")}>
                  Syscalls
                </button>
                <button className="btn" disabled={busy} onClick={() => run("memory")}>
                  Memory
                </button>
                <button className="btn" disabled={busy} onClick={() => run("scheduler")}>
                  Threads
                </button>
                <button className="btn" disabled={busy} onClick={() => run("network")}>
                  Network
                </button>
                <button className="btn" disabled={busy} onClick={() => run("tcp")}>
                  TCP
                </button>
                <button className="btn" disabled={busy} onClick={() => run("dns")}>
                  DNS
                </button>
                <button className="btn" disabled={busy} onClick={() => run("http")}>
                  HTTP
                </button>
                <button className="btn" disabled={busy} onClick={() => run("database")}>
                  Database
                </button>
                <button className="btn" disabled={busy} onClick={() => run("packets")}>
                  Packets
                </button>
                <button className="btn" disabled={busy} onClick={() => run("failures")}>
                  Failures
                </button>
                <button className="btn" disabled={busy} onClick={() => run("load")}>
                  Load
                </button>
              </div>
              <SystemMap events={events} selectedLayer={layer} onSelectLayer={setLayer} />
              <LearningPane event={selected} layer={layer} />
            </>
          )}

          {nav === "processes" && (
            <>
              <h1>Processes</h1>
              <p className="lede">Parent creates a child. /proc samples are REAL.</p>
              <div className="actions">
                <button className="btn" disabled={busy} onClick={() => run("process")}>
                  {busy ? "Running…" : "RUN — create child process"}
                </button>
                <button className="btn ghost" onClick={inspectLatestPid}>
                  Inspect latest PID via /proc
                </button>
              </div>
              <div className="grid-2">
                <div className="card">
                  <h3>PROCESS TREE</h3>
                  <div className="proc-tree">
                    {parents.length === 0 && children.length === 0 && <span className="coming">No samples yet.</span>}
                    {parents.map((p) => (
                      <div key={p.id}>
                        Parent pid={p.pid} ppid={p.ppid}
                        {children
                          .filter((c) => c.ppid === p.pid)
                          .map((c) => (
                            <div key={c.id}>
                              {"├── "}Child pid={c.pid} ppid={c.ppid}
                            </div>
                          ))}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="card">
                  <h3>/PROC</h3>
                  <p className="mono" style={{ color: "var(--muted)", margin: 0 }}>
                    status · maps · task/ · smaps_rollup
                  </p>
                </div>
              </div>
              {procView && <div className="detail-box">{procView}</div>}
              <LearningPane event={selected ?? processEvents.at(-1) ?? null} layer="process" />
            </>
          )}

          {nav === "syscalls" && (
            <>
              <h1>System Calls</h1>
              <p className="lede">File I/O under strace. Go function ≠ syscall.</p>
              <div className="actions">
                <button className="btn" disabled={busy} onClick={() => run("syscalls")}>
                  {busy ? "Tracing…" : "RUN — file I/O under strace"}
                </button>
              </div>
              <LearningPane
                event={selected ?? events.filter((e) => e.kind === "syscall").at(-1) ?? null}
                layer="syscall"
              />
            </>
          )}

          {nav === "memory" && (
            <>
              <h1>Memory</h1>
              <p className="lede">
                Virtual size vs RSS: touch faults pages in.
              </p>
              <div className="actions">
                <button className="btn" disabled={busy} onClick={() => run("memory")}>
                  {busy ? "Sampling…" : "RUN — allocate / touch / release"}
                </button>
              </div>
              <MemoryView events={events} selectedPhase={memPhase} onSelectPhase={setMemPhase} />
              <LearningPane
                event={
                  selected ?? events.filter((e) => e.kind === "memory" && e.source === "REAL").at(-1) ?? null
                }
                layer="memory"
              />
            </>
          )}

          {nav === "cpu" && (
            <>
              <h1>Threads / Scheduler</h1>
              <p className="lede">
                Many goroutines ≠ many OS threads (<code>GOMAXPROCS=2</code>).
              </p>
              <div className="actions">
                <button className="btn" disabled={busy} onClick={() => run("scheduler")}>
                  {busy ? "Sampling…" : "RUN — goroutines vs OS threads"}
                </button>
              </div>
              <ThreadsView events={events} selectedPhase={schedPhase} onSelectPhase={setSchedPhase} />
              <LearningPane
                event={
                  selected ?? events.filter((e) => e.kind === "thread" && e.source === "REAL").at(-1) ?? null
                }
                layer="go_runtime"
              />
            </>
          )}

          {nav === "network" && (
            <>
              <h1>Network</h1>
              <p className="lede">
                Local Go HTTP client/server on <code>127.0.0.1</code>. Watch LISTEN → connected sockets via{" "}
                <code>ss</code>, plus host NICs/routes from <code>ip</code>.
              </p>
              <div className="actions">
                <button className="btn" disabled={busy} onClick={() => run("network")}>
                  {busy ? "Sampling…" : "RUN — local client/server"}
                </button>
              </div>
              <NetworkView
                events={events}
                selectedPhase={netPhase}
                onSelectPhase={setNetPhase}
                hostIfaces={netIfaces}
                hostRoutes={netRoutes}
                defaultDev={defaultDev}
              />
              <LearningPane
                event={
                  selected ?? events.filter((e) => e.kind === "network" && e.source === "REAL").at(-1) ?? null
                }
                layer="net"
              />
            </>
          )}

          {nav === "tcp" && (
            <>
              <h1>TCP Connection</h1>
              <p className="lede">
                Raw socket client/server on loopback. <code>ss</code> shows LISTEN/ESTAB/teardown states; SYN packet
                arrows are inferred unless ss catches SYN-SENT/SYN-RECV.
              </p>
              <div className="actions">
                <button className="btn" disabled={busy} onClick={() => run("tcp")}>
                  {busy ? "Tracing…" : "RUN — TCP handshake + data + close"}
                </button>
              </div>
              <TcpView events={events} selectedPhase={tcpPhase} onSelectPhase={setTcpPhase} />
              <LearningPane
                event={selected ?? events.filter((e) => e.kind === "tcp" && e.source === "REAL").at(-1) ?? null}
                layer="net"
              />
            </>
          )}

          {nav === "dns" && (
            <>
              <h1>DNS</h1>
              <p className="lede">
                REAL lookup via the system resolver (<code>/etc/resolv.conf</code> + Go{" "}
                <code>net.Resolver</code>). Optional <code>dig</code> enriches TTL.
              </p>
              <div className="actions">
                <button className="btn" disabled={busy} onClick={() => run("dns")}>
                  {busy ? "Resolving…" : `RUN — lookup ${dnsDomain}`}
                </button>
              </div>
              <DnsView events={events} domain={dnsDomain} onDomainChange={setDnsDomain} />
              <LearningPane
                event={selected ?? events.filter((e) => e.kind === "dns" && e.source === "REAL").at(-1) ?? null}
                layer="net"
              />
            </>
          )}

          {nav === "http" && (
            <>
              <h1>HTTP</h1>
              <p className="lede">
                Local <code>GET /api/users</code> through <code>net/http</code> — REAL status, headers, handler timing.
              </p>
              <div className="actions">
                <button className="btn" disabled={busy} onClick={() => run("http")}>
                  {busy ? "Requesting…" : "RUN — GET /api/users"}
                </button>
              </div>
              <HttpView events={events} />
              <LearningPane
                event={selected ?? events.filter((e) => e.kind === "http" && e.source === "REAL").at(-1) ?? null}
                layer="application"
              />
            </>
          )}

          {nav === "database" && (
            <>
              <h1>Database</h1>
              <p className="lede">
                Local <code>GET /api/users</code> where the handler runs a REAL SQLite query via{" "}
                <code>database/sql</code>.
              </p>
              <div className="actions">
                <button className="btn" disabled={busy} onClick={() => run("database")}>
                  {busy ? "Querying…" : "RUN — HTTP + SQLite SELECT"}
                </button>
              </div>
              <DatabaseView events={events} />
              <LearningPane
                event={
                  selected ?? events.filter((e) => e.kind === "database" && e.source === "REAL").at(-1) ?? null
                }
                layer="vfs"
              />
            </>
          )}

          {nav === "packets" && (
            <>
              <h1>Packets</h1>
              <p className="lede">
                Attempt REAL <code>tcpdump</code> on loopback during a TCP exchange. If CAP_NET_RAW is missing, the
                lab reports the block and shows a labeled SIMULATION sequence — never fake frames.
              </p>
              <div className="actions">
                <button className="btn" disabled={busy} onClick={() => run("packets")}>
                  {busy ? "Capturing…" : "RUN — TCP + packet capture"}
                </button>
              </div>
              <PacketsView events={events} tools={tools} />
              <LearningPane
                event={selected ?? events.filter((e) => e.kind === "packet").at(-1) ?? null}
                layer="net"
              />
            </>
          )}

          {nav === "failures" && (
            <>
              <h1>Failures</h1>
              <p className="lede">
                Controlled faults — timeout, HTTP 500, slow success, connection refused — with REAL client outcomes.
              </p>
              <div className="actions">
                <button className="btn" disabled={busy} onClick={() => run("failures")}>
                  {busy ? "Injecting…" : "RUN — fault matrix"}
                </button>
              </div>
              <FailuresView events={events} />
              <LearningPane
                event={selected ?? events.filter((e) => e.kind === "failure" && e.source === "REAL").at(-1) ?? null}
                layer="application"
              />
            </>
          )}

          {nav === "load" && (
            <>
              <h1>Load Test</h1>
              <p className="lede">
                Concurrent HTTP clients against a local handler — REAL counts, DERIVED latency percentiles.
              </p>
              <div className="actions">
                <button className="btn" disabled={busy} onClick={() => run("load")}>
                  {busy ? "Loading…" : "RUN — concurrent requests"}
                </button>
              </div>
              <LoadView events={events} />
              <LearningPane
                event={selected ?? events.filter((e) => e.kind === "load").at(-1) ?? null}
                layer="application"
              />
            </>
          )}

          {nav === "e2e" && (
            <>
              <h1>E2E Request</h1>
              <p className="lede">
                One button — REAL DNS lookup, TCP connect, HTTP GET, and SQLite query on loopback.
              </p>
              <div className="actions">
                <button className="btn" disabled={busy} onClick={() => run("e2e")}>
                  {busy ? "Sending…" : "SEND REQUEST — GET /api/users"}
                </button>
              </div>
              <E2EView events={events} />
              <LearningPane
                event={selected ?? events.filter((e) => e.experiment === "e2e" && e.source === "REAL").at(-1) ?? null}
                layer="application"
              />
            </>
          )}

          {nav === "postgres" && (
            <>
              <h1>PostgreSQL Internals</h1>
              <p className="lede">
                Deep engine reference — processes, MVCC, WAL, vacuum, planner, locks, replication. Pair with{" "}
                <code>psql</code> on a real cluster for REAL stats.
              </p>
              <PostgresInternalsView />
              <LearningPane event={null} layer="vfs" />
            </>
          )}

          {nav === "observability" && (
            <>
              <h1>Observability</h1>
              <p className="lede">
                Aggregated REAL snapshot from <code>/proc</code>, <code>ip</code>, <code>ss</code>, tool probes, and the
                event ring.
              </p>
              <ObservabilityView events={events} />
              <LearningPane
                event={selected ?? events.filter((e) => e.kind === "observability").at(-1) ?? null}
                layer="application"
              />
            </>
          )}

          {nav === "tools" && (
            <>
              <h1>Host Tools</h1>
              <p className="lede">Capability probe — missing tools are never silently faked.</p>
              <table className="tools-table">
                <thead>
                  <tr>
                    <th>Tool</th>
                    <th>Usable</th>
                    <th>Detail</th>
                    <th>Install / fix</th>
                  </tr>
                </thead>
                <tbody>
                  {tools.map((t) => (
                    <tr key={t.name}>
                      <td className="mono">{t.name}</td>
                      <td className={t.usable ? "ok" : "bad"}>{t.usable ? "yes" : "no"}</td>
                      <td>{t.detail}</td>
                      <td className="mono">{t.usable ? "—" : (t.install_hint ?? "—")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {!["map", "processes", "syscalls", "memory", "cpu", "network", "tcp", "dns", "http", "database", "packets", "failures", "load", "observability", "e2e", "postgres", "tools"].includes(nav) && (
            <>
              <h1>{NAV.find((n) => n.id === nav)?.label}</h1>
              <p className="coming">Later phase — see systems-lab/DEVELOPMENT_PLAN.md</p>
            </>
          )}
        </div>
      </main>

      <Timeline
        events={events}
        selected={selected}
        onSelect={setSelected}
        onClear={() => {
          void clear();
          setSelected(null);
        }}
      />
    </div>
  );
}
