import type { Topic } from "@/types/topic";

export const rateLimiting: Topic = {
  id: "rate-limiting",
  title: "Rate Limiting",
  category: "reliability",
  difficulty: "intermediate",
  isDeepDive: true,
  description:
    "Rate limiting caps how many requests a client can make in a given window, protecting your system from being overwhelmed — accidentally or on purpose.",
  concepts: ["Token Bucket", "Sliding Window", "Fixed Window", "429 Too Many Requests", "Burst Traffic"],
  howItWorks: [
    "Every incoming request is checked against a counter tied to some key — usually a user ID, API key, or IP address.",
    "A fixed window algorithm counts requests per key within a time bucket (e.g. per minute) and rejects once the count exceeds the limit.",
    "A token bucket algorithm gives each key a bucket of tokens that refill at a steady rate; each request consumes a token, allowing short bursts as long as tokens are available.",
    "Once a client exceeds their limit, the API rejects further requests with a 429 status until the window resets or tokens refill.",
  ],
  architecture: [
    { id: "client", label: "Client", role: "client", x: 20, y: 200 },
    { id: "gw", label: "API Gateway", role: "gateway", x: 280, y: 200, summary: "Enforces the limit before routing." },
    { id: "redis", label: "Redis (counters)", role: "cache", x: 560, y: 100, summary: "Stores per-client request counts.",
      detail: {
        role: "Shared counter store",
        why: "Rate limits must be enforced consistently across multiple gateway instances — a per-process counter wouldn't work once you scale horizontally.",
        input: "INCR rate:client123",
        output: "Current count for this window",
        operations: ["INCR", "EXPIRE", "EVAL (atomic check+increment)"],
        related: ["redis", "distributed-locks"],
      },
    },
    { id: "api", label: "API Server", role: "service", x: 560, y: 320, summary: "Only reached if the request is within limits." },
  ],
  edges: [
    { id: "e1", source: "client", target: "gw", kind: "sync" },
    { id: "e2", source: "gw", target: "redis", kind: "sync", label: "check + increment" },
    { id: "e3", source: "gw", target: "api", kind: "sync", label: "if allowed" },
  ],
  requestFlow: [
    { id: "s1", nodeId: "client", title: "Client makes a request", description: "Client X sends its 21st request within the current 1-minute window.", operation: "GET /search?q=redis" },
    { id: "s2", nodeId: "gw", title: "Gateway checks the limit", description: "The gateway looks up client X's current request count for this window before doing anything else." },
    { id: "s3", nodeId: "redis", title: "Counter is checked and incremented", description: "Redis atomically increments the counter and returns the new value.", operation: "INCR rate:clientX:2026-09-08T10:41", outcome: "21 (limit: 20)" },
    { id: "s4", nodeId: "gw", title: "Request is rejected", description: "Since 21 exceeds the limit of 20, the gateway rejects the request without ever reaching the API server.", outcome: "429 Too Many Requests" },
  ],
  implementations: [
    {
      id: "fixed-window",
      filename: "rateLimit.middleware.ts",
      language: "TypeScript",
      description: "A fixed-window limiter using Redis INCR with an expiry equal to the window size.",
      relatedNodes: ["gw", "redis"],
      code: `async function rateLimit(clientId: string, limit: number, windowSec: number) {
  const window = Math.floor(Date.now() / 1000 / windowSec);
  const key = \`rate:\${clientId}:\${window}\`;

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSec);
  }

  if (count > limit) {
    throw new TooManyRequestsError();
  }
}`,
    },
    {
      id: "token-bucket",
      filename: "tokenBucket.lua",
      language: "lua",
      description: "A token-bucket limiter as a Redis Lua script, so the check-and-consume is atomic.",
      relatedNodes: ["redis"],
      code: `-- KEYS[1] = bucket key, ARGV = [capacity, refillRate, now]
local capacity = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local bucket = redis.call("HMGET", KEYS[1], "tokens", "ts")
local tokens = tonumber(bucket[1]) or capacity
local last = tonumber(bucket[2]) or now

local elapsed = now - last
tokens = math.min(capacity, tokens + elapsed * refillRate)

if tokens < 1 then
  return 0
end

redis.call("HMSET", KEYS[1], "tokens", tokens - 1, "ts", now)
return 1`,
    },
  ],
  tradeoffs: {
    advantages: [
      "Protects backend capacity from abusive or buggy clients",
      "Token bucket allows natural short bursts while still capping sustained rate",
      "Cheap to enforce at the edge (gateway) before expensive work happens downstream",
    ],
    disadvantages: [
      "Fixed windows allow a burst of 2x the limit right at the window boundary",
      "Requires a shared, fast store (Redis) to coordinate limits across multiple gateway instances",
      "Overly strict limits create a bad experience for legitimate high-volume users",
    ],
    whenToUse:
      "Apply rate limiting at the API gateway for any public or partner-facing API. Use token bucket when bursts are expected and acceptable; use fixed or sliding window when you need a hard cap on total requests per period.",
  },
  failureModes: [
    {
      id: "redis-unavailable",
      title: "The rate-limit store is unavailable",
      scenario: "Redis, which backs the rate limiter, becomes unreachable.",
      path: ["gw", "redis"],
      explanation: "The gateway must decide: fail open (allow all requests through, risking overload) or fail closed (reject everything, causing an outage). Most systems fail open for rate limiting specifically, since it's a protective — not correctness — mechanism.",
      consequences: ["Fail open: temporary loss of protection against abuse", "Fail closed: a rate limiter outage becomes a full API outage"],
    },
    {
      id: "boundary-burst",
      title: "Fixed-window boundary burst",
      scenario: "A client sends 20 requests at 10:00:59 and another 20 at 10:01:00.",
      path: ["client", "gw"],
      explanation: "Since these fall into two different fixed windows, the client effectively sent 40 requests in about one second, even though the limit was 20/minute.",
      consequences: ["Momentary traffic spikes beyond the intended limit", "Sliding-window or token-bucket algorithms avoid this edge case"],
    },
  ],
  scaling: [
    {
      id: "stage1",
      title: "No rate limiting",
      description: "Every request is accepted regardless of volume.",
      nodes: ["Client", "API"],
      problem: "A single misbehaving client or bot can exhaust backend capacity for everyone.",
    },
    {
      id: "stage2",
      title: "Per-client limits at the gateway",
      description: "Enforce a request cap per API key/user using a shared Redis counter.",
      nodes: ["Client", "API Gateway", "Redis", "API"],
      solution: "Abusive clients are throttled before they can affect shared backend capacity.",
      tradeoff: "Adds a Redis round-trip to every request's critical path.",
    },
    {
      id: "stage3",
      title: "Tiered and adaptive limits",
      description: "Different limits per subscription tier, plus global circuit breakers that tighten limits automatically under system-wide load.",
      nodes: ["Client", "Gateway (tiered limits)", "Redis", "API"],
      problem: "A single flat limit doesn't fit free vs paid tiers, and static limits don't protect against system-wide overload.",
      solution: "Layer per-tier limits with dynamic, load-aware throttling.",
      tradeoff: "Meaningfully more configuration and monitoring to get right.",
    },
  ],
  relatedTopics: ["circuit-breaker", "api-gateway", "redis", "backpressure"],
};
