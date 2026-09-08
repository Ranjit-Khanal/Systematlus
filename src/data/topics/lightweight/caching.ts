import type { Topic } from "@/types/topic";

export const cachingLightweight: Topic[] = [
  {
    id: "write-through",
    title: "Write-Through",
    category: "caching",
    difficulty: "intermediate",
    isDeepDive: false,
    description:
      "In write-through caching, every write goes to the cache and the database together (synchronously), so the cache is never stale — at the cost of every write paying both latencies.",
    concepts: ["Synchronous Write", "Cache Consistency"],
    relatedTopics: ["cache-aside", "write-behind", "redis"],
  },
  {
    id: "write-behind",
    title: "Write-Behind",
    category: "caching",
    difficulty: "advanced",
    isDeepDive: false,
    description:
      "Write-behind (write-back) caching writes to the cache immediately and asynchronously flushes to the database later, trading a small durability risk for lower write latency.",
    concepts: ["Async Flush", "Durability Risk", "Batching Writes"],
    relatedTopics: ["write-through", "cache-aside"],
  },
  {
    id: "ttl",
    title: "TTL",
    category: "caching",
    difficulty: "beginner",
    isDeepDive: false,
    description:
      "A time-to-live is how long a cached value is allowed to live before it's automatically treated as expired — the simplest and most common cache invalidation strategy.",
    concepts: ["Expiry", "Self-healing Staleness"],
    relatedTopics: ["cache-invalidation", "redis", "cache-eviction"],
  },
  {
    id: "cache-eviction",
    title: "Cache Eviction",
    category: "caching",
    difficulty: "intermediate",
    isDeepDive: false,
    description:
      "When a cache is full, it must decide what to remove to make room for new entries. Common policies include LRU (evict least-recently-used) and LFU (evict least-frequently-used).",
    concepts: ["LRU", "LFU", "Memory Pressure"],
    relatedTopics: ["ttl", "cache-invalidation", "redis"],
  },
  {
    id: "distributed-cache",
    title: "Distributed Cache",
    category: "caching",
    difficulty: "advanced",
    isDeepDive: false,
    description:
      "A distributed cache spreads cached data across multiple nodes, so total cache capacity and throughput scale beyond what a single machine's memory can hold.",
    concepts: ["Sharded Cache", "Consistent Hashing", "Redis Cluster"],
    relatedTopics: ["redis", "consistent-hashing", "hot-keys"],
  },
  {
    id: "hot-keys",
    title: "Hot Keys",
    category: "caching",
    difficulty: "advanced",
    isDeepDive: false,
    description:
      "A hot key is a single cache key that receives disproportionately high traffic — enough to overload the one node responsible for it, even when the overall cluster has spare capacity.",
    concepts: ["Traffic Skew", "Local Caching", "Key Splitting"],
    relatedTopics: ["distributed-cache", "redis", "url-shortener"],
  },
];
