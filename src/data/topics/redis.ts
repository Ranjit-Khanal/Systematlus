import type { Topic } from "@/types/topic";

export const redis: Topic = {
  id: "redis",
  title: "Redis",
  category: "caching",
  difficulty: "intermediate",
  isDeepDive: true,
  description:
    "Redis keeps frequently accessed data in memory, so applications can retrieve it in under a millisecond without querying the primary database every time.",
  concepts: ["In-Memory Store", "Cache", "TTL", "Pub/Sub", "Distributed Lock", "Data Structures"],
  howItWorks: [
    "Redis stores data entirely in RAM using simple key-value structures (strings, hashes, sets, sorted sets, lists), which is why reads and writes are so fast.",
    "Applications typically use it as a cache in front of a slower database: check Redis first, fall back to the database on a miss, then populate Redis for next time.",
    "Keys can have a TTL (time-to-live) so stale data expires automatically instead of living forever.",
    "Beyond caching, Redis's atomic operations (INCR, SETNX) make it useful for counters, rate limiters, and simple distributed locks.",
  ],
  architecture: [
    { id: "client", label: "Client", role: "client", x: 20, y: 200 },
    { id: "api", label: "API Server", role: "service", x: 280, y: 200, summary: "Checks Redis before hitting PostgreSQL." },
    { id: "redis", label: "Redis", role: "cache", x: 560, y: 100, summary: "In-memory cache, counters, locks.",
      detail: {
        role: "Cache / fast key-value store",
        why: "Reduces database reads and provides low-latency access to frequently used data.",
        input: "GET user:123",
        output: "Cached user data (or a miss)",
        operations: ["GET", "SET", "DEL", "EXPIRE", "INCR"],
        failure: "Cache unavailable → requests fall back to PostgreSQL, increasing database load and latency.",
        related: ["cache-aside", "ttl", "distributed-locks"],
      },
    },
    { id: "db", label: "PostgreSQL", role: "database", x: 560, y: 320, summary: "Source of truth on a cache miss." },
  ],
  edges: [
    { id: "e1", source: "client", target: "api", kind: "sync" },
    { id: "e2", source: "api", target: "redis", kind: "sync", label: "GET user:123" },
    { id: "e3", source: "redis", target: "db", kind: "sync", label: "cache miss" },
  ],
  requestFlow: [
    { id: "s1", nodeId: "client", title: "Client requests a user", description: "The client asks for a user's profile.", operation: "GET /users/123" },
    { id: "s2", nodeId: "api", title: "API checks Redis first", description: "Before touching PostgreSQL, the API checks whether this user is already cached.", operation: "GET user:123", latencyMs: 1 },
    { id: "s3", nodeId: "redis", title: "Cache hit", description: "Redis has the data in memory and returns it immediately.", outcome: "CACHE HIT", latencyMs: 1 },
    { id: "s4", nodeId: "db", title: "(On a miss) query PostgreSQL", description: "If Redis didn't have the data, the API would query PostgreSQL and store the result back in Redis for next time.", operation: "SELECT * FROM users WHERE id = 123", outcome: "CACHE MISS path", latencyMs: 25 },
  ],
  implementations: [
    {
      id: "cache-aside-redis",
      filename: "user.service.ts",
      language: "TypeScript",
      description: "The classic cache-aside pattern: check cache, fall back to DB, repopulate cache.",
      relatedNodes: ["api", "redis", "db"],
      code: `const cached = await redis.get(\`user:\${id}\`);

if (cached) {
  return JSON.parse(cached);
}

const user = await db.user.findUnique({
  where: { id },
});

await redis.set(
  \`user:\${id}\`,
  JSON.stringify(user),
  { EX: 300 },
);

return user;`,
    },
    {
      id: "redis-lock",
      filename: "lock.ts",
      language: "TypeScript",
      description: "A simple distributed lock using SET with NX (only if not exists) and an expiry.",
      relatedNodes: ["redis"],
      code: `const token = crypto.randomUUID();

const acquired = await redis.set(
  \`lock:\${resourceId}\`,
  token,
  { NX: true, PX: 5000 },
);

if (!acquired) throw new Error("Resource is locked");

try {
  // critical section
} finally {
  // release only if we still own the lock
  await redis.eval(RELEASE_SCRIPT, [\`lock:\${resourceId}\`], [token]);
}`,
    },
  ],
  tradeoffs: {
    advantages: [
      "Sub-millisecond reads and writes since everything lives in RAM",
      "Versatile data structures beyond simple key-value (sets, sorted sets, streams)",
      "Atomic primitives make it useful for counters, rate limiting, and locks, not just caching",
    ],
    disadvantages: [
      "One more piece of infrastructure to deploy, monitor, and keep highly available",
      "Cache invalidation is a real design problem — stale data is easy to serve accidentally",
      "Data is volatile by default; persistence options (RDB/AOF) trade some durability for speed",
    ],
    whenToUse:
      "Use Redis when the same data is read far more often than it changes, and a few hundred milliseconds of staleness is acceptable — session storage, hot product pages, leaderboards, rate limit counters.",
  },
  failureModes: [
    {
      id: "redis-down",
      title: "Redis goes down",
      scenario: "The Redis instance or cluster becomes unreachable.",
      path: ["client", "api", "redis"],
      explanation: "The application can fall back to PostgreSQL directly for every request that would have hit the cache.",
      consequences: [
        "Database traffic increases sharply — potentially 10-100x depending on cache hit rate",
        "Latency increases across the board since every request now hits disk-backed storage",
        "A large Redis outage can trigger cascading failure if the database wasn't sized for full direct traffic",
      ],
    },
    {
      id: "hot-key",
      title: "A single key gets overwhelming traffic",
      scenario: "A viral post's cache key receives far more reads than any other key.",
      path: ["client", "redis"],
      explanation: "A single Redis node (or shard) handling one key can become a bottleneck even though the cluster overall has capacity.",
      consequences: ["Increased latency for that specific key", "Mitigated with local in-process caching or key sharding for hot items"],
    },
  ],
  scaling: [
    {
      id: "stage1",
      title: "No cache",
      description: "API queries PostgreSQL directly for every request.",
      nodes: ["API", "PostgreSQL"],
      problem: "Database reads become the bottleneck as traffic grows.",
    },
    {
      id: "stage2",
      title: "Introduce caching",
      description: "Add Redis in front of PostgreSQL for hot reads.",
      nodes: ["API", "Redis", "PostgreSQL"],
      solution: "Most reads are served from memory, dramatically cutting database load and latency.",
      tradeoff: "Cache invalidation complexity; possible staleness.",
    },
    {
      id: "stage3",
      title: "Redis Cluster",
      description: "A single Redis node becomes a memory or throughput bottleneck; shard data across a Redis Cluster.",
      nodes: ["API", "Redis Cluster (sharded)", "PostgreSQL + Read Replicas"],
      problem: "Dataset or request volume exceeds one Redis node's capacity.",
      solution: "Partition keys across multiple Redis nodes using consistent hashing.",
      tradeoff: "Multi-key operations across shards become limited; more operational complexity.",
    },
  ],
  relatedTopics: ["cache-aside", "cache-invalidation", "ttl", "distributed-locks", "hot-keys"],
};
