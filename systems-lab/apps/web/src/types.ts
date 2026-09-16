export type Source = "REAL" | "SIMULATION" | "DERIVED";

export type LabEvent = {
  id: string;
  ts: string;
  rel_ns?: number;
  source: Source;
  kind: string;
  layer?: string;
  experiment?: string;
  pid?: number;
  tid?: number;
  ppid?: number;
  summary: string;
  detail?: Record<string, unknown>;
  explain_key?: string;
};

export type ToolStatus = {
  name: string;
  present: boolean;
  path?: string;
  usable: boolean;
  detail: string;
  install_hint?: string;
  needed_for?: string;
};

export type HostInfo = {
  hostname: string;
  kernel_release: string;
  kernel_version: string;
  cpus: number;
  mem_total_kb: number;
  mem_available_kb: number;
  uptime_sec: number;
};

export type NavId =
  | "map"
  | "processes"
  | "syscalls"
  | "cpu"
  | "memory"
  | "network"
  | "tcp"
  | "dns"
  | "http"
  | "database"
  | "packets"
  | "failures"
  | "load"
  | "observability"
  | "e2e"
  | "postgres"
  | "tools";

export const NAV: { id: NavId; label: string; ready: boolean }[] = [
  { id: "map", label: "SYSTEM MAP", ready: true },
  { id: "processes", label: "PROCESSES", ready: true },
  { id: "syscalls", label: "SYSCALLS", ready: true },
  { id: "cpu", label: "CPU / THREADS", ready: true },
  { id: "memory", label: "MEMORY", ready: true },
  { id: "network", label: "NETWORK", ready: true },
  { id: "tcp", label: "TCP", ready: true },
  { id: "dns", label: "DNS", ready: true },
  { id: "http", label: "HTTP", ready: true },
  { id: "database", label: "DATABASE", ready: true },
  { id: "packets", label: "PACKETS", ready: true },
  { id: "failures", label: "FAILURES", ready: true },
  { id: "load", label: "LOAD TEST", ready: true },
  { id: "observability", label: "OBSERVABILITY", ready: true },
  { id: "e2e", label: "E2E REQUEST", ready: true },
  { id: "postgres", label: "POSTGRES INTERNALS", ready: true },
  { id: "tools", label: "TOOLS", ready: true },
];
