import type { HostInfo, LabEvent, ToolStatus } from "./types";

export type ObservabilitySnapshot = {
  collected_at: string;
  source: string;
  host: HostInfo;
  network: { interfaces?: unknown[]; routes?: unknown[]; default_dev?: string };
  network_err?: string;
  tcp: { total: number; by_state?: Record<string, number> };
  tcp_err?: string;
  tools: ToolStatus[];
  tools_usable: number;
  tools_total: number;
  capture: { usable: boolean; detail: string; present?: boolean };
  events: {
    total: number;
    by_source?: Record<string, number>;
    by_kind?: Record<string, number>;
    by_experiment?: Record<string, number>;
    last_experiment?: string;
    last_event_ts?: string;
    last_event_kind?: string;
  };
};

const base = ""; // proxied by Vite in dev

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function postJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${base}${path}`, { method: "POST" });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  health: () => getJSON<{ ok: boolean }>("/api/health"),
  tools: () => getJSON<{ tools: ToolStatus[]; source: string }>("/api/tools"),
  host: () => getJSON<{ host: HostInfo; source: string }>("/api/host"),
  recent: () => getJSON<{ events: LabEvent[] }>("/api/events/recent?n=300"),
  clear: () => postJSON<{ cleared: boolean }>("/api/events/clear"),
  runProcess: () => postJSON<Record<string, unknown>>("/api/experiments/process/run"),
  runSyscalls: () => postJSON<Record<string, unknown>>("/api/experiments/syscalls/run"),
  runMemory: () => postJSON<Record<string, unknown>>("/api/experiments/memory/run"),
  runScheduler: () => postJSON<Record<string, unknown>>("/api/experiments/scheduler/run"),
  runNetwork: () => postJSON<Record<string, unknown>>("/api/experiments/network/run"),
  runTCP: () => postJSON<Record<string, unknown>>("/api/experiments/tcp/run"),
  runDNS: (domain?: string) =>
    postJSON<Record<string, unknown>>(
      `/api/experiments/dns/run${domain ? `?domain=${encodeURIComponent(domain)}` : ""}`,
    ),
  runHTTP: () => postJSON<Record<string, unknown>>("/api/experiments/http/run"),
  runDatabase: () => postJSON<Record<string, unknown>>("/api/experiments/database/run"),
  runPackets: () => postJSON<Record<string, unknown>>("/api/experiments/packets/run"),
  runFailures: () => postJSON<Record<string, unknown>>("/api/experiments/failures/run"),
  runLoad: () => postJSON<Record<string, unknown>>("/api/experiments/load/run"),
  observability: () => getJSON<{ snapshot: ObservabilitySnapshot; source: string }>("/api/observability"),
  refreshObservability: () =>
    postJSON<{ snapshot: ObservabilitySnapshot; event_id: string; source: string }>("/api/observability/refresh"),
  runE2E: () => postJSON<Record<string, unknown>>("/api/experiments/e2e/run"),
  networkHost: () => getJSON<{ host: { interfaces: unknown[]; routes: unknown[]; default_dev?: string }; source: string }>("/api/network"),
  proc: (pid: number) => getJSON<{ snapshot: unknown; source: string }>(`/api/proc/${pid}`),
};

export function connectEvents(onEvent: (e: LabEvent) => void): () => void {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  // Prefer same-origin proxy path so cookies/CORS stay simple in dev.
  const url = `${proto}://${location.host}/api/ws`;
  let ws: WebSocket | null = new WebSocket(url);
  let closed = false;

  ws.onmessage = (msg) => {
    try {
      onEvent(JSON.parse(String(msg.data)) as LabEvent);
    } catch {
      /* ignore */
    }
  };

  ws.onclose = () => {
    if (closed) return;
    // reconnect lightly
    setTimeout(() => {
      if (!closed) {
        const next = connectEvents(onEvent);
        // replace cleanup by closing new socket if parent already cleaned — handled via closed flag on old only
        void next;
      }
    }, 1500);
  };

  return () => {
    closed = true;
    ws?.close();
    ws = null;
  };
}
