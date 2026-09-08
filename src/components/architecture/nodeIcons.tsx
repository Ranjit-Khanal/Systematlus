import { Monitor, Server, Database, Zap, Inbox, Globe, GitBranch, ShieldCheck, Cog, HardDrive } from "lucide-react";
import type { NodeRole } from "@/types/topic";

export const roleIcon: Record<NodeRole, typeof Monitor> = {
  client: Monitor,
  service: Server,
  database: Database,
  cache: Zap,
  queue: Inbox,
  external: Globe,
  loadbalancer: GitBranch,
  gateway: ShieldCheck,
  worker: Cog,
  storage: HardDrive,
};

export const roleLabel: Record<NodeRole, string> = {
  client: "Client",
  service: "Service",
  database: "Database",
  cache: "Cache",
  queue: "Queue",
  external: "External",
  loadbalancer: "Load Balancer",
  gateway: "Gateway",
  worker: "Worker",
  storage: "Storage",
};

export const roleShape: Record<NodeRole, "square" | "diamond" | "circle"> = {
  client: "square",
  service: "square",
  database: "diamond",
  cache: "diamond",
  queue: "square",
  external: "circle",
  loadbalancer: "square",
  gateway: "square",
  worker: "square",
  storage: "diamond",
};
