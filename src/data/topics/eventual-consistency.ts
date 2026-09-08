import type { Topic } from "@/types/topic";

export const eventualConsistency: Topic = {
  id: "eventual-consistency",
  title: "Eventual Consistency",
  category: "distributed-systems",
  difficulty: "advanced",
  isDeepDive: true,
  description:
    "Eventual consistency means that if you stop writing to a distributed system, all replicas will eventually agree — but right after a write, different readers might briefly see different answers.",
  concepts: ["CAP Theorem", "Replication Lag", "Read-Your-Writes", "Conflict Resolution", "Convergence"],
  howItWorks: [
    "In a distributed system, keeping every replica perfectly in sync at all times requires coordination that costs latency and availability — the CAP theorem's tradeoff.",
    "Eventually consistent systems accept that replicas can be temporarily out of sync, in exchange for staying fast and available even during network issues.",
    "Writes propagate asynchronously to replicas. Given enough time with no new writes, every replica converges to the same value.",
    "Applications that need stronger guarantees for specific operations (like a user seeing their own just-posted comment) implement patterns like read-your-writes on top of an eventually consistent store.",
  ],
  architecture: [
    { id: "client", label: "Client", role: "client", x: 20, y: 200 },
    { id: "api", label: "API Server", role: "service", x: 260, y: 200 },
    { id: "node1", label: "Node A (US)", role: "database", x: 560, y: 60, summary: "Receives the write first." },
    { id: "node2", label: "Node B (EU)", role: "database", x: 560, y: 200, summary: "Replicates asynchronously.",
      detail: {
        role: "Replica node",
        why: "Serving reads from the nearest regional node keeps latency low, at the cost of possibly returning slightly stale data.",
        input: "Async replication stream from Node A",
        output: "Eventually-converged local copy",
        failure: "A network partition can delay convergence indefinitely until connectivity is restored.",
        related: ["database-replication", "consistency"],
      },
    },
    { id: "node3", label: "Node C (APAC)", role: "database", x: 560, y: 340 },
  ],
  edges: [
    { id: "e1", source: "client", target: "api", kind: "sync" },
    { id: "e2", source: "api", target: "node1", kind: "sync", label: "write" },
    { id: "e3", source: "node1", target: "node2", kind: "async", label: "replicate" },
    { id: "e4", source: "node1", target: "node3", kind: "async", label: "replicate" },
  ],
  requestFlow: [
    { id: "s1", nodeId: "api", title: "A write is accepted", description: "A user updates their status. The write is accepted immediately by the nearest node.", operation: "PUT /status" },
    { id: "s2", nodeId: "node1", title: "Node A commits the write locally", description: "Node A now has the new value and acknowledges success to the client — it does not wait for other regions.", outcome: "ack (fast)", latencyMs: 5 },
    { id: "s3", nodeId: "node2", title: "Node B hasn't received it yet", description: "A read hitting Node B milliseconds later may still return the old status — this is the consistency window.", outcome: "stale read (temporary)", latencyMs: 1 },
    { id: "s4", nodeId: "node3", title: "Eventually, all nodes converge", description: "Within a short window (typically milliseconds to a few seconds), replication catches up and every node agrees.", outcome: "converged" },
  ],
  implementations: [
    {
      id: "read-your-writes",
      filename: "statusService.ts",
      language: "TypeScript",
      description: "A common pattern: route a user's own reads to the node that accepted their most recent write, for a brief window.",
      relatedNodes: ["api", "node1"],
      code: `async function updateStatus(userId: string, status: string) {
  const writeNode = await primaryFor(userId);
  await writeNode.write("status", { userId, status });

  // Remember which node/timestamp this user just wrote to.
  session.set("lastWrite", { node: writeNode.id, at: Date.now() });
}

async function getStatus(userId: string) {
  const lastWrite = session.get("lastWrite");
  const recentlyWroteHere = lastWrite && Date.now() - lastWrite.at < 10_000;

  const node = recentlyWroteHere ? nodeFor(lastWrite.node) : nearestReplica();
  return node.read("status", userId);
}`,
    },
  ],
  tradeoffs: {
    advantages: [
      "Stays available and fast even during network partitions between regions",
      "Scales horizontally without a single node becoming a coordination bottleneck",
      "Well suited to data where brief staleness is harmless — like counts, feeds, or presence",
    ],
    disadvantages: [
      "Applications must be written to tolerate temporarily inconsistent reads",
      "Conflicting concurrent writes to the same key need an explicit resolution strategy (last-write-wins, merge, vector clocks)",
      "Debugging becomes harder — 'it worked when I checked a second later' is a real, confusing failure mode",
    ],
    whenToUse:
      "Accept eventual consistency for data where availability and low latency matter more than every reader seeing the absolute latest value immediately — social feeds, view counts, search indexes, product catalogs. Avoid it for money movement or anything requiring strict ordering guarantees.",
  },
  failureModes: [
    {
      id: "network-partition",
      title: "Network partition between regions",
      scenario: "The link between the US and EU data centers goes down.",
      path: ["node1", "node2"],
      explanation: "Each side keeps accepting writes independently (favoring availability), but they can't replicate to each other until the partition heals.",
      consequences: ["Divergent data on each side of the partition", "Conflict resolution needed once connectivity is restored"],
    },
    {
      id: "conflicting-writes",
      title: "Concurrent conflicting writes",
      scenario: "A user updates their profile from two devices at nearly the same time, hitting two different nodes.",
      path: ["node1", "node2"],
      explanation: "Both writes are individually accepted. When the nodes reconcile, the system must decide which one wins — or merge them.",
      consequences: ["Without a clear strategy, one update can silently overwrite the other", "Common resolutions: last-write-wins by timestamp, or application-level merge logic"],
    },
  ],
  scaling: [
    {
      id: "stage1",
      title: "Single strongly consistent node",
      description: "One database, always immediately consistent.",
      nodes: ["API", "Single DB"],
      problem: "Doesn't scale across regions; a network issue makes the node fully unavailable.",
    },
    {
      id: "stage2",
      title: "Multi-region replicas, eventually consistent",
      description: "Writes accepted regionally and replicated asynchronously.",
      nodes: ["API (US)", "API (EU)", "Node A", "Node B"],
      solution: "Low-latency regional reads/writes and resilience to partial network issues.",
      tradeoff: "Application must handle temporary inconsistency between regions.",
    },
    {
      id: "stage3",
      title: "Tunable consistency",
      description: "Let each operation choose its consistency level — e.g. Cassandra-style QUORUM reads/writes for critical paths, ONE for everything else.",
      nodes: ["API", "Quorum read/write", "Replica set"],
      problem: "A single global consistency policy doesn't fit every operation's needs.",
      solution: "Choose stronger consistency (more replica coordination) only where correctness truly requires it.",
      tradeoff: "More nuanced code paths and more ways to get the choice wrong.",
    },
  ],
  relatedTopics: ["cap-theorem", "consistency", "database-replication", "availability"],
};
