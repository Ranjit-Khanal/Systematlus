import type { Topic } from "@/types/topic";

export const urlShortener: Topic = {
  id: "url-shortener",
  title: "URL Shortener",
  category: "real-world-systems",
  difficulty: "beginner",
  isDeepDive: false,
  description:
    "A URL shortener turns a long link into a short code, and later redirects anyone who visits that code back to the original URL — simple in concept, deceptively full of scaling lessons.",
  concepts: ["Short Code Generation", "Redirect", "Base62 Encoding", "Hot URLs", "Caching"],
  howItWorks: [
    "Creating a short link: the API generates a unique short code (often a base62-encoded counter or a hash), stores the mapping short code → original URL, and returns the short link.",
    "Visiting a short link: the API looks up the code, finds the original URL, and responds with an HTTP redirect (301/302) to it.",
    "Because the same handful of links get the vast majority of traffic, a cache in front of the database turns the hot path into a memory lookup instead of a disk read.",
    "Short codes must be unique and short — a base62 alphabet (a-z, A-Z, 0-9) packs a lot of unique values into just 6-7 characters.",
  ],
  architecture: [
    { id: "client", label: "Client", role: "client", x: 20, y: 220 },
    { id: "lb", label: "Load Balancer", role: "loadbalancer", x: 260, y: 220 },
    { id: "api", label: "API Server", role: "service", x: 500, y: 220, summary: "Creates and resolves short codes." },
    { id: "redis", label: "Redis", role: "cache", x: 760, y: 100, summary: "Caches hot short-code → URL mappings.",
      detail: {
        role: "Cache",
        why: "A small fraction of links receive most redirect traffic — caching them avoids a database hit on every click.",
        input: "GET code:abc123",
        output: "Cached original URL",
        related: ["cache-aside", "hot-keys"],
      },
    },
    { id: "db", label: "PostgreSQL", role: "database", x: 760, y: 340, summary: "Source of truth for all mappings." },
  ],
  edges: [
    { id: "e1", source: "client", target: "lb", kind: "sync" },
    { id: "e2", source: "lb", target: "api", kind: "sync" },
    { id: "e3", source: "api", target: "redis", kind: "sync", label: "check cache" },
    { id: "e4", source: "api", target: "db", kind: "sync", label: "on miss / on write" },
  ],
  requestFlow: [
    { id: "s1", nodeId: "client", title: "User visits a short link", description: "A click on go.example/abc123 hits the load balancer.", operation: "GET /abc123" },
    { id: "s2", nodeId: "api", title: "API looks up the code", description: "The API server checks the cache before the database.", operation: "lookup('abc123')" },
    { id: "s3", nodeId: "redis", title: "Cache hit", description: "Redis returns the original URL immediately.", outcome: "CACHE HIT: https://example.com/very/long/path", latencyMs: 1 },
    { id: "s4", nodeId: "client", title: "Redirect response", description: "The API responds with a 301 redirect, and the browser navigates to the original URL.", outcome: "301 → https://example.com/very/long/path" },
  ],
  implementations: [
    {
      id: "create-short-url",
      filename: "shorten.service.ts",
      language: "TypeScript",
      description: "Generating a short code using a base62-encoded auto-increment ID keeps codes short and collision-free without extra coordination.",
      relatedNodes: ["api", "db"],
      code: `const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function toBase62(n: number): string {
  if (n === 0) return "0";
  let s = "";
  while (n > 0) {
    s = BASE62[n % 62] + s;
    n = Math.floor(n / 62);
  }
  return s;
}

async function createShortUrl(longUrl: string) {
  const { id } = await db.urls.insert({ longUrl });
  const code = toBase62(id);
  await db.urls.update(id, { code });
  return code;
}`,
    },
    {
      id: "redirect-handler",
      filename: "redirect.route.ts",
      language: "TypeScript",
      description: "The redirect path checks Redis first, exactly like the general cache-aside pattern.",
      relatedNodes: ["api", "redis", "db"],
      code: `app.get("/:code", async (req, res) => {
  const cached = await redis.get(\`code:\${req.params.code}\`);
  if (cached) return res.redirect(301, cached);

  const row = await db.urls.findByCode(req.params.code);
  if (!row) return res.status(404).send("Not found");

  await redis.set(\`code:\${req.params.code}\`, row.longUrl, { EX: 3600 });
  res.redirect(301, row.longUrl);
});`,
    },
  ],
  database: {
    tables: [
      {
        name: "urls",
        columns: [
          { name: "id", type: "bigint", isPrimaryKey: true },
          { name: "code", type: "varchar(10)", isIndexed: true, note: "unique short code" },
          { name: "long_url", type: "text" },
          { name: "created_at", type: "timestamptz" },
          { name: "click_count", type: "bigint" },
        ],
        exampleRows: [{ id: 12345, code: "3d7", long_url: "https://example.com/a/very/long/path", click_count: 8231 }],
      },
    ],
  },
  tradeoffs: {
    advantages: [
      "Extremely simple core mechanism — a lookup table and a redirect",
      "Read-heavy workload caches exceptionally well",
      "Base62 counters generate short, collision-free codes with no coordination needed",
    ],
    disadvantages: [
      "A predictable counter-based code lets someone guess adjacent codes and enumerate links",
      "Hot links (viral content) can concentrate huge traffic on a single cache key",
      "301 redirects are cached by browsers, making it hard to change a mapping later; 302 avoids that at the cost of repeated lookups",
    ],
    whenToUse:
      "This pattern generalizes beyond URL shortening to any 'short identifier → full resource' lookup — invite codes, referral links, or coupon codes.",
  },
  failureModes: [
    {
      id: "cache-miss-storm",
      title: "A viral link's cache entry expires",
      scenario: "A short link goes viral right as its TTL expires.",
      path: ["client", "redis", "db"],
      explanation: "A burst of simultaneous requests all miss the cache at once and hit the database simultaneously to reload the same row.",
      consequences: ["Momentary database load spike", "Mitigated with longer TTLs for high-click-count links or request coalescing"],
    },
  ],
  scaling: [
    {
      id: "stage1",
      title: "Single server",
      description: "One API server and one database handle everything.",
      nodes: ["Client", "API", "PostgreSQL"],
      problem: "Fine for low traffic; redirect latency depends entirely on database speed.",
    },
    {
      id: "stage2",
      title: "Add caching and a load balancer",
      description: "Cache hot mappings in Redis; scale API servers horizontally behind a load balancer.",
      nodes: ["Client", "Load Balancer", "API × N", "Redis", "PostgreSQL"],
      problem: "Redirect traffic vastly outnumbers link-creation traffic and is highly skewed toward a few popular links.",
      solution: "Serve the hot path almost entirely from memory.",
      tradeoff: "Slight staleness for click counts if they're cached too.",
    },
    {
      id: "stage3",
      title: "CDN edge redirects",
      description: "Push redirects to CDN edge nodes so the origin API is only hit for cache misses.",
      nodes: ["Client", "CDN Edge", "API", "Redis", "PostgreSQL"],
      problem: "Global users experience latency from a single origin region.",
      solution: "Serve redirects from the nearest edge location.",
      tradeoff: "Invalidating or updating a mapping across edge nodes adds complexity.",
    },
  ],
  relatedTopics: ["cache-aside", "load-balancer", "hot-keys", "consistent-hashing"],
};
