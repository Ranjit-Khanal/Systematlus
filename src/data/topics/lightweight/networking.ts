import type { Topic } from "@/types/topic";

export const networkingLightweight: Topic[] = [
  {
    id: "http",
    title: "HTTP",
    category: "networking",
    difficulty: "beginner",
    isDeepDive: false,
    description:
      "HTTP is the request/response protocol almost the entire web is built on: a client sends a method and path, the server sends back a status code and body.",
    concepts: ["Methods", "Status Codes", "Headers", "HTTP/1.1 vs HTTP/2"],
    relatedTopics: ["rest", "tcp", "client-server-architecture"],
  },
  {
    id: "rest",
    title: "REST",
    category: "networking",
    difficulty: "beginner",
    isDeepDive: false,
    description:
      "REST is a convention for designing HTTP APIs around resources (nouns) and standard verbs (GET, POST, PUT, DELETE), rather than one-off action endpoints.",
    concepts: ["Resources", "Verbs", "Statelessness", "HATEOAS"],
    relatedTopics: ["http", "api-gateway"],
  },
  {
    id: "websockets",
    title: "WebSockets",
    category: "networking",
    difficulty: "intermediate",
    isDeepDive: false,
    description:
      "A WebSocket upgrades a single HTTP connection into a persistent, two-way channel — letting the server push data to the client without the client having to ask again and again.",
    concepts: ["Full-Duplex", "Connection Upgrade", "Real-time"],
    relatedTopics: ["sse", "chat-system", "connection-pooling"],
  },
  {
    id: "sse",
    title: "SSE",
    category: "networking",
    difficulty: "intermediate",
    isDeepDive: false,
    description:
      "Server-Sent Events let a server push a one-way stream of updates to the client over plain HTTP — simpler than WebSockets when you only need server-to-client updates.",
    concepts: ["One-way Streaming", "EventSource", "Long-lived Connection"],
    relatedTopics: ["websockets", "notification-system"],
  },
  {
    id: "dns",
    title: "DNS",
    category: "networking",
    difficulty: "beginner",
    isDeepDive: false,
    description:
      "DNS translates human-readable domain names into IP addresses. It's also commonly used for traffic routing and failover — pointing a domain at a different region if one goes down.",
    concepts: ["Domain Resolution", "TTL", "Failover Routing"],
    relatedTopics: ["cdn", "load-balancer"],
  },
  {
    id: "cdn",
    title: "CDN",
    category: "networking",
    difficulty: "beginner",
    isDeepDive: false,
    description:
      "A CDN caches static (and sometimes dynamic) content at edge locations close to users, cutting latency and offloading traffic from the origin server.",
    concepts: ["Edge Caching", "Origin Server", "Cache Invalidation"],
    relatedTopics: ["cache-aside", "dns", "url-shortener"],
  },
  {
    id: "tcp",
    title: "TCP",
    category: "networking",
    difficulty: "intermediate",
    isDeepDive: false,
    description:
      "TCP guarantees reliable, ordered delivery of bytes between two machines — the foundation almost all backend protocols (HTTP included) are built on top of.",
    concepts: ["Three-way Handshake", "Ordered Delivery", "Connection State"],
    relatedTopics: ["http", "connection-pooling"],
  },
  {
    id: "connection-pooling",
    title: "Connection Pooling",
    category: "networking",
    difficulty: "intermediate",
    isDeepDive: false,
    description:
      "Opening a new database (or network) connection is expensive. A connection pool keeps a set of connections open and reused across requests instead of creating one per request.",
    concepts: ["Pool Size", "Connection Exhaustion", "Idle Timeout"],
    relatedTopics: ["tcp", "postgresql", "database-transactions"],
  },
];
