import type { Topic } from "@/types/topic";

export const cacheAside: Topic = {
  id: "cache-aside",
  title: "Cache-Aside",
  category: "caching",
  difficulty: "intermediate",
  isDeepDive: true,
  description:
    "Cache-aside puts the application in charge of the cache: check it first, and only ask the database when the cache doesn't have an answer.",
  concepts: ["Lazy Loading", "Cache Miss", "Cache Hit", "TTL", "Read-Through vs Cache-Aside"],
  howItWorks: [
    "On a read, the application checks the cache first.",
    "If the data is there (a hit), return it immediately — the database is never touched.",
    "If it's missing (a miss), query the database, then write the result into the cache before returning it, so the next read is a hit.",
    "The cache is 'aside' the application's normal logic — the database and cache are never in a special relationship; the application code is the only thing that keeps them loosely in sync.",
  ],
  architecture: [
    { id: "client", label: "Client", role: "client", x: 20, y: 200 },
    { id: "api", label: "API Server", role: "service", x: 300, y: 200, summary: "Owns the check-cache → fallback-to-db logic.",
      detail: {
        role: "Cache orchestrator",
        why: "Unlike read-through caching, the application explicitly controls when to read from cache vs database, and when to populate the cache.",
        input: "Read request for a key",
        output: "Cached or freshly-loaded value",
        operations: ["cache.get", "db.query (on miss)", "cache.set (populate)"],
        related: ["redis", "cache-invalidation"],
      },
    },
    { id: "cache", label: "Redis", role: "cache", x: 600, y: 100 },
    { id: "db", label: "PostgreSQL", role: "database", x: 600, y: 320 },
  ],
  edges: [
    { id: "e1", source: "client", target: "api", kind: "sync" },
    { id: "e2", source: "api", target: "cache", kind: "sync", label: "1. check" },
    { id: "e3", source: "api", target: "db", kind: "sync", label: "2. on miss" },
    { id: "e4", source: "api", target: "cache", kind: "sync", label: "3. populate" },
  ],
  requestFlow: [
    { id: "s1", nodeId: "api", title: "Check the cache", description: "Before doing anything else, ask Redis for the key.", operation: "GET product:88" },
    { id: "s2", nodeId: "cache", title: "Cache miss", description: "The key isn't present — maybe it expired, or this is the first request for it.", outcome: "MISS" },
    { id: "s3", nodeId: "db", title: "Load from the database", description: "Fall back to the source of truth.", operation: "SELECT * FROM products WHERE id = 88", latencyMs: 20 },
    { id: "s4", nodeId: "cache", title: "Populate the cache", description: "Write the result into Redis with a TTL, so the next request for product 88 is a hit.", operation: "SET product:88 ... EX 300" },
  ],
  implementations: [
    {
      id: "cache-aside-impl",
      filename: "product.service.ts",
      language: "TypeScript",
      description: "A reusable cache-aside helper that any read path can use.",
      relatedNodes: ["api", "cache", "db"],
      code: `async function getOrLoad<T>(
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>,
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const value = await load();
  await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  return value;
}

// Usage:
const product = await getOrLoad(
  \`product:\${id}\`,
  300,
  () => db.product.findUnique({ where: { id } }),
);`,
    },
  ],
  tradeoffs: {
    advantages: [
      "Simple to reason about: application code fully controls what's cached and when",
      "Only requested data ever gets cached — no wasted memory on unused rows",
      "The cache can fail entirely and reads still work (just slower), since the app always has a database fallback",
    ],
    disadvantages: [
      "Every cache miss pays the full database latency on top of the cache check",
      "Two round trips (cache + db) on a miss instead of one",
      "The application must remember to invalidate or update the cache on writes — easy to forget",
    ],
    whenToUse:
      "Use cache-aside as the default caching pattern for read-heavy data with occasional writes — user profiles, product details, computed reports. Pair it with a sensible TTL so mistakes self-heal.",
  },
  failureModes: [
    {
      id: "cache-miss",
      title: "Cache miss",
      scenario: "A key expires or was never cached.",
      path: ["api", "cache", "db"],
      explanation: "This is the expected, designed-for path — not a failure. The request simply takes the slower database route once.",
      consequences: ["Slightly higher latency for that one request", "Cache is warmed for subsequent requests"],
    },
    {
      id: "thundering-herd",
      title: "Thundering herd on a popular key",
      scenario: "A cached key with heavy traffic expires, and hundreds of concurrent requests all miss at once.",
      path: ["api", "cache", "db"],
      explanation: "Every one of those requests independently queries the database at the same moment, spiking load — even though only one query was actually necessary.",
      consequences: ["Sudden database load spike", "Mitigated with request coalescing (a lock around the reload) or slightly jittered TTLs"],
    },
  ],
  scaling: [
    {
      id: "stage1",
      title: "Direct database reads",
      description: "Every read goes straight to PostgreSQL.",
      nodes: ["API", "PostgreSQL"],
      problem: "Repeated reads for the same rarely-changing data waste database capacity.",
    },
    {
      id: "stage2",
      title: "Cache-aside",
      description: "Check Redis first; populate it on miss.",
      nodes: ["API", "Redis", "PostgreSQL"],
      solution: "Most reads are served from memory after the first miss.",
      tradeoff: "Application owns cache correctness; misses still pay full latency.",
    },
    {
      id: "stage3",
      title: "Add request coalescing",
      description: "Prevent thundering herds by ensuring only one request reloads a given key while others wait for that result.",
      nodes: ["API (coalesced loads)", "Redis", "PostgreSQL"],
      problem: "Popular keys expiring cause simultaneous duplicate database loads.",
      solution: "Use an in-process or distributed lock so only one request repopulates a cold key.",
      tradeoff: "Slightly more complex loading logic.",
    },
  ],
  relatedTopics: ["redis", "cache-invalidation", "ttl", "cache-eviction", "write-through"],
};
