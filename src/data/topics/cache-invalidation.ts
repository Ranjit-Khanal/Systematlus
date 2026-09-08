import type { Topic } from "@/types/topic";

export const cacheInvalidation: Topic = {
  id: "cache-invalidation",
  title: "Cache Invalidation",
  category: "caching",
  difficulty: "advanced",
  isDeepDive: true,
  description:
    "Cache invalidation is how you tell the cache that the data it's holding is no longer correct — famously one of the two hard problems in computer science.",
  concepts: ["TTL Expiry", "Write-Through Invalidation", "Event-Based Invalidation", "Stale Reads", "Cache Stampede"],
  howItWorks: [
    "The simplest strategy is TTL expiry: every cached value automatically disappears after N seconds, bounding how stale it can ever be.",
    "A more precise strategy is explicit invalidation: when the underlying data changes, the write path actively deletes or updates the corresponding cache key.",
    "In event-driven systems, a change in one service can publish an event that other services consume to invalidate their own caches of that data.",
    "No strategy is free: TTLs risk serving stale data until expiry; explicit invalidation risks missing an update path and leaving a key stale forever.",
  ],
  architecture: [
    { id: "api", label: "API Server", role: "service", x: 60, y: 200, summary: "Writes to DB and invalidates cache." },
    { id: "cache", label: "Redis", role: "cache", x: 380, y: 100 },
    { id: "db", label: "PostgreSQL", role: "database", x: 380, y: 320 },
    { id: "other-svc", label: "Other Service", role: "service", x: 680, y: 100, summary: "Also caches this data and must be told it changed.",
      detail: {
        role: "Downstream cache consumer",
        why: "Multiple services may cache the same underlying data independently — each needs its own invalidation signal.",
        input: "product.updated event",
        output: "Local cache entry deleted",
        related: ["pub-sub", "event-driven-architecture"],
      },
    },
  ],
  edges: [
    { id: "e1", source: "api", target: "db", kind: "sync", label: "UPDATE product" },
    { id: "e2", source: "api", target: "cache", kind: "sync", label: "DEL product:88" },
    { id: "e3", source: "api", target: "other-svc", kind: "async", label: "product.updated" },
  ],
  requestFlow: [
    { id: "s1", nodeId: "api", title: "Product price is updated", description: "An admin changes a product's price through the API.", operation: "PUT /products/88" },
    { id: "s2", nodeId: "db", title: "Database is updated", description: "The new price is written to PostgreSQL — the source of truth.", operation: "UPDATE products SET price = 1999 WHERE id = 88" },
    { id: "s3", nodeId: "cache", title: "Cache key is invalidated", description: "The API explicitly deletes the cached entry so the next read is forced to reload the fresh value.", operation: "DEL product:88" },
    { id: "s4", nodeId: "other-svc", title: "Other services are notified", description: "An event is published so any other service caching this product also knows to drop its copy.", operation: "publish product.updated" },
  ],
  implementations: [
    {
      id: "write-through-invalidate",
      filename: "product.service.ts",
      language: "TypeScript",
      description: "Invalidate-on-write: update the database, then delete the cache key rather than trying to update it in place.",
      relatedNodes: ["api", "db", "cache"],
      code: `async function updateProduct(id: string, changes: ProductChanges) {
  await db.product.update({ where: { id }, data: changes });

  // Deleting is safer than overwriting: the next
  // read will lazily reload the correct fresh value.
  await redis.del(\`product:\${id}\`);

  await eventBus.publish("product.updated", { id });
}`,
    },
    {
      id: "ttl-fallback",
      filename: "config.ts",
      language: "TypeScript",
      description: "Even with explicit invalidation, always set a TTL as a safety net for missed invalidation paths.",
      relatedNodes: ["cache"],
      code: `// Belt and suspenders: if an invalidation path is ever
// missed, the key still self-heals within 5 minutes.
await redis.set(key, value, { EX: 300 });`,
    },
  ],
  tradeoffs: {
    advantages: [
      "Explicit invalidation gives near-immediate consistency after a write",
      "TTL-based expiry is simple and self-healing — no invalidation logic can be 'missed'",
      "Event-based invalidation keeps multiple services' caches in sync without tight coupling",
    ],
    disadvantages: [
      "Explicit invalidation requires finding every write path that touches the data — easy to miss one",
      "TTL alone means users can see stale data for up to the full TTL window",
      "Invalidating a key right as many requests arrive can cause a cache stampede",
    ],
    whenToUse:
      "Use TTLs everywhere as a baseline safety net. Add explicit invalidation on top for data where staleness is user-visible and unacceptable, like a price or an account balance.",
  },
  failureModes: [
    {
      id: "missed-invalidation",
      title: "A write path forgets to invalidate",
      scenario: "A new admin endpoint updates a product directly but a developer forgets to add the cache invalidation call.",
      path: ["api", "db"],
      explanation: "The database has the new value but the cache still serves the old one — indefinitely, until the TTL (if any) expires.",
      consequences: ["Users see incorrect data, sometimes for a long time", "Hard to debug because the database looks correct"],
    },
    {
      id: "stampede",
      title: "Cache stampede",
      scenario: "A hot key is invalidated right as thousands of requests for it arrive.",
      path: ["cache", "db"],
      explanation: "Every request misses at the same time and hits the database simultaneously, since none of them know another request is already reloading the value.",
      consequences: ["Sudden database load spike", "Mitigated with a short-lived lock or 'stale-while-revalidate' serving of the old value during reload"],
    },
  ],
  scaling: [
    {
      id: "stage1",
      title: "TTL-only",
      description: "Every cached value simply expires after a fixed window.",
      nodes: ["API", "Redis (TTL)", "PostgreSQL"],
      problem: "Simple, but staleness windows can be user-visible for important data.",
    },
    {
      id: "stage2",
      title: "Explicit invalidation on write",
      description: "Writes actively delete the affected cache key.",
      nodes: ["API (write + DEL)", "Redis", "PostgreSQL"],
      solution: "Much shorter staleness window for data that changed.",
      tradeoff: "Must track every write path that affects a cached key.",
    },
    {
      id: "stage3",
      title: "Event-driven invalidation",
      description: "Publish a change event so any number of downstream caches (in other services) can invalidate themselves.",
      nodes: ["API", "Event Bus", "Service B cache", "Service C cache"],
      problem: "Multiple services independently cache the same data; direct invalidation calls don't scale to N consumers.",
      solution: "Decouple the writer from the invalidators using pub/sub.",
      tradeoff: "Invalidation becomes eventually consistent across services, with its own small lag.",
    },
  ],
  relatedTopics: ["cache-aside", "redis", "ttl", "cache-eviction", "event-driven-architecture"],
};
