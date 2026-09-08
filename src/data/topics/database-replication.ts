import type { Topic } from "@/types/topic";

export const databaseReplication: Topic = {
  id: "database-replication",
  title: "Database Replication",
  category: "databases",
  difficulty: "intermediate",
  isDeepDive: true,
  description:
    "Replication keeps copies of your database on multiple machines, so reads can be spread across replicas and the system survives losing any single node.",
  concepts: ["Primary-Replica", "Read Replicas", "Replication Lag", "WAL", "Failover", "Synchronous vs Asynchronous"],
  howItWorks: [
    "One database is the primary — it accepts all writes. One or more replicas continuously receive a stream of changes from the primary (in PostgreSQL, this is the write-ahead log, or WAL).",
    "Replicas apply that stream to keep their own copy of the data in sync, and can serve read queries independently of the primary.",
    "Replication is usually asynchronous: the primary doesn't wait for replicas to confirm before considering a write done. This means replicas can lag slightly behind — replication lag.",
    "If the primary fails, a replica can be promoted to become the new primary — failover — though any writes that hadn't yet replicated are lost.",
  ],
  architecture: [
    { id: "api", label: "API Server", role: "service", x: 60, y: 200 },
    { id: "primary", label: "PostgreSQL Primary", role: "database", x: 380, y: 100, summary: "Accepts all writes.",
      detail: {
        role: "Write master",
        why: "A single source of truth for writes avoids conflicting updates from multiple masters.",
        input: "INSERT / UPDATE / DELETE",
        output: "WAL stream to replicas",
        operations: ["Accept writes", "Stream WAL", "Promote on failover (as target)"],
        failure: "If the primary fails, writes stop until a replica is promoted — this failover isn't instant.",
        related: ["read-replicas", "consistency"],
      },
    },
    { id: "replica1", label: "Read Replica 1", role: "database", x: 700, y: 40, summary: "Serves read traffic." },
    { id: "replica2", label: "Read Replica 2", role: "database", x: 700, y: 200 },
  ],
  edges: [
    { id: "e1", source: "api", target: "primary", kind: "sync", label: "writes" },
    { id: "e2", source: "api", target: "replica1", kind: "sync", label: "reads" },
    { id: "e3", source: "api", target: "replica2", kind: "sync", label: "reads" },
    { id: "e4", source: "primary", target: "replica1", kind: "async", label: "WAL stream" },
    { id: "e5", source: "primary", target: "replica2", kind: "async", label: "WAL stream" },
  ],
  requestFlow: [
    { id: "s1", nodeId: "api", title: "Write request arrives", description: "A client updates their profile. Writes always go to the primary.", operation: "UPDATE users SET name = 'Ana' WHERE id = 1" },
    { id: "s2", nodeId: "primary", title: "Primary commits and streams the change", description: "The primary applies the write and appends it to its write-ahead log, which is streamed continuously to every replica.", latencyMs: 2 },
    { id: "s3", nodeId: "replica1", title: "Replica applies the change", description: "Replica 1 receives the WAL entry and applies it, usually within milliseconds — this delay is the replication lag.", latencyMs: 15, outcome: "eventually consistent" },
    { id: "s4", nodeId: "replica2", title: "A read hits a lagging replica", description: "If a read for the same user hits Replica 2 before it's caught up, it may briefly return the old name.", outcome: "stale read (rare, brief)" },
  ],
  implementations: [
    {
      id: "read-write-split",
      filename: "db.ts",
      language: "TypeScript",
      description: "Route writes to the primary and reads to a replica pool.",
      relatedNodes: ["api", "primary", "replica1"],
      code: `const primary = createPool({ host: "db-primary.internal" });
const replicas = createPool({ host: "db-replica.internal" });

export const db = {
  write: (sql: string, params: unknown[]) => primary.query(sql, params),
  read: (sql: string, params: unknown[]) => replicas.query(sql, params),
};

// Usage:
await db.write("UPDATE users SET name = $1 WHERE id = $2", [name, id]);
const user = await db.read("SELECT * FROM users WHERE id = $1", [id]);`,
    },
    {
      id: "read-after-write",
      filename: "read-your-writes.ts",
      language: "TypeScript",
      description: "Sometimes a user needs to see their own write immediately — read from the primary just after writing to avoid replication lag.",
      relatedNodes: ["primary"],
      code: `await db.write("UPDATE users SET name = $1 WHERE id = $2", [name, id]);

// Read the just-updated row from the primary,
// not a replica that might not have caught up yet.
const fresh = await db.write("SELECT * FROM users WHERE id = $1", [id]);`,
    },
  ],
  tradeoffs: {
    advantages: [
      "Spreads read traffic across multiple machines, multiplying read capacity",
      "Provides a standby copy that can be promoted if the primary fails",
      "Replicas can also serve as a live backup and for analytics without impacting the primary",
    ],
    disadvantages: [
      "Replication lag means replicas can serve stale data for a short window",
      "Failover isn't instant and can lose the last few unreplicated writes (with async replication)",
      "Writes still funnel through a single primary — replication doesn't scale write throughput",
    ],
    whenToUse:
      "Add read replicas once read traffic — not write traffic — is your bottleneck, and your application can tolerate briefly stale reads for non-critical paths (e.g. a public profile page, but not a bank balance check).",
  },
  failureModes: [
    {
      id: "primary-failure",
      title: "Primary database fails",
      scenario: "The primary crashes or becomes unreachable.",
      path: ["api", "primary"],
      explanation: "All writes fail until a replica is promoted to primary. Promotion requires detecting the failure, choosing a replica, and updating routing — this takes real time, not milliseconds.",
      consequences: ["Write downtime during failover", "Any writes not yet replicated to the promoted replica are lost"],
    },
    {
      id: "replication-lag-spike",
      title: "Replication lag spikes",
      scenario: "A replica falls behind due to a heavy analytical query or network issues.",
      path: ["primary", "replica2"],
      explanation: "Reads from that replica can return data that's seconds or minutes old instead of milliseconds.",
      consequences: ["Users may see their own recent changes disappear temporarily", "Mitigated by monitoring lag and routing critical reads to the primary"],
    },
  ],
  scaling: [
    {
      id: "stage1",
      title: "Single database",
      description: "One PostgreSQL instance handles all reads and writes.",
      nodes: ["API", "PostgreSQL"],
      problem: "Read traffic grows and starts competing with writes for the same resources.",
    },
    {
      id: "stage2",
      title: "Add read replicas",
      description: "Introduce one or more replicas and split traffic: writes to primary, reads to replicas.",
      nodes: ["API", "Primary", "Replica × 2"],
      solution: "Read capacity now scales independently of write capacity.",
      tradeoff: "Application must tolerate eventual consistency for replica reads.",
    },
    {
      id: "stage3",
      title: "Sharding + replication",
      description: "When writes themselves outgrow a single primary, combine replication with sharding — each shard has its own primary and replicas.",
      nodes: ["API", "Shard 1 (Primary + Replicas)", "Shard 2 (Primary + Replicas)"],
      problem: "A single primary can no longer handle write volume.",
      solution: "Partition data across multiple primaries, each independently replicated.",
      tradeoff: "Cross-shard queries and transactions become significantly harder.",
    },
  ],
  relatedTopics: ["read-replicas", "database-sharding", "consistency", "eventual-consistency"],
};
