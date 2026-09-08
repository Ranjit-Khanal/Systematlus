import type { Topic } from "@/types/topic";

export const apiGateway: Topic = {
  id: "api-gateway",
  title: "API Gateway",
  category: "architecture",
  difficulty: "intermediate",
  isDeepDive: true,
  description:
    "An API gateway is the single entry point for all client requests into a system of backend services — it handles routing, auth, and rate limiting so individual services don't have to.",
  concepts: ["API Gateway", "Routing", "Authentication", "Rate Limiting", "Microservices", "BFF"],
  howItWorks: [
    "Every external request hits the gateway first, never a backend service directly.",
    "The gateway authenticates the request (validates a token or API key) before anything else runs.",
    "It routes the request to the correct downstream service based on the path, e.g. /orders/* → Orders Service.",
    "It can also apply cross-cutting concerns once, centrally: rate limiting, request logging, response caching, and request/response transformation.",
  ],
  architecture: [
    { id: "client", label: "Client", role: "client", x: 40, y: 220 },
    { id: "gw", label: "API Gateway", role: "gateway", x: 300, y: 220, summary: "Single entry point for all services.",
      detail: {
        role: "Edge router & policy enforcement",
        why: "Centralizes auth, rate limiting, and routing so every backend service doesn't reimplement them.",
        input: "Client HTTP request with auth token",
        output: "Routed request to the correct microservice",
        operations: ["Authenticate", "Rate limit", "Route", "Aggregate responses"],
        failure: "The gateway is a critical path for every request — it must be deployed with redundancy and generous timeouts to downstream services.",
        related: ["load-balancer", "rate-limiting", "microservices"],
      },
    },
    { id: "auth", label: "Auth Service", role: "service", x: 300, y: 40, summary: "Validates tokens." },
    { id: "orders", label: "Orders Service", role: "service", x: 600, y: 120 },
    { id: "users", label: "Users Service", role: "service", x: 600, y: 220 },
    { id: "payments", label: "Payments Service", role: "service", x: 600, y: 320 },
  ],
  edges: [
    { id: "e1", source: "client", target: "gw", kind: "sync" },
    { id: "e2", source: "gw", target: "auth", kind: "sync", label: "validate token" },
    { id: "e3", source: "gw", target: "orders", kind: "sync", label: "/orders/*" },
    { id: "e4", source: "gw", target: "users", kind: "sync", label: "/users/*" },
    { id: "e5", source: "gw", target: "payments", kind: "sync", label: "/payments/*" },
  ],
  requestFlow: [
    { id: "s1", nodeId: "client", title: "Client calls the gateway", description: "The client only knows one host: api.example.com. It has no idea how many services exist behind it.", operation: "GET /orders/42" },
    { id: "s2", nodeId: "auth", title: "Gateway validates the token", description: "Before routing anywhere, the gateway checks the bearer token's signature and expiry.", outcome: "valid", latencyMs: 5 },
    { id: "s3", nodeId: "gw", title: "Gateway matches a route", description: "The path /orders/42 is matched against the route table and mapped to the Orders Service.", operation: "route: /orders/* → orders-svc" },
    { id: "s4", nodeId: "orders", title: "Orders Service responds", description: "The Orders Service handles the actual business logic and returns order data.", outcome: "200 OK", latencyMs: 30 },
  ],
  implementations: [
    {
      id: "gateway-route",
      filename: "gateway.ts",
      language: "TypeScript",
      description: "A simplified gateway middleware chain: auth, then rate limit, then proxy to the matched service.",
      relatedNodes: ["gw", "auth", "orders"],
      code: `app.use(async (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const claims = await authClient.verify(token);
  if (!claims) return res.status(401).json({ error: "unauthorized" });
  req.user = claims;
  next();
});

app.use(rateLimit({ windowMs: 1000, max: 20 }));

app.use("/orders", proxy("http://orders-svc:4001"));
app.use("/users", proxy("http://users-svc:4002"));
app.use("/payments", proxy("http://payments-svc:4003"));`,
    },
  ],
  tradeoffs: {
    advantages: [
      "One place to enforce auth, rate limiting, and logging instead of duplicating it in every service",
      "Clients see a single, stable API surface even as backend services change",
      "Enables response aggregation (BFF pattern) for mobile/web-specific shapes",
    ],
    disadvantages: [
      "Becomes a critical, high-traffic component that must scale and stay available",
      "Adds a network hop and a place where latency and bugs can accumulate",
      "Can turn into a dumping ground for business logic if not governed carefully",
    ],
    whenToUse:
      "Adopt an API gateway once you have more than a couple of services, or once you need centralized auth/rate limiting. For a single monolith, a gateway is usually unnecessary overhead.",
  },
  failureModes: [
    {
      id: "gateway-down",
      title: "Gateway becomes unavailable",
      scenario: "The gateway tier is overloaded or crashes.",
      path: ["client", "gw"],
      explanation: "Since every request must pass through the gateway, this is a full outage even though every backend service is healthy.",
      consequences: ["Total request failure", "Underlines why the gateway must run multiple replicas behind its own load balancer"],
    },
    {
      id: "downstream-timeout",
      title: "A downstream service is slow",
      scenario: "Orders Service is under heavy load and responds slowly.",
      path: ["gw", "orders"],
      explanation: "Without a timeout, the gateway's connections pile up waiting on a slow service, which can exhaust its own connection pool and take down unrelated routes too.",
      consequences: ["Cascading slowness across unrelated services", "Mitigated with per-route timeouts and circuit breakers"],
    },
  ],
  scaling: [
    {
      id: "stage1",
      title: "Direct client-to-service calls",
      description: "Clients call each microservice directly.",
      nodes: ["Client", "Orders Service", "Users Service"],
      problem: "Every service must implement its own auth, rate limiting, and CORS handling — and clients must track multiple hostnames.",
    },
    {
      id: "stage2",
      title: "Introduce a gateway",
      description: "Put a single gateway in front of all services.",
      nodes: ["Client", "API Gateway", "Orders", "Users", "Payments"],
      solution: "Centralize cross-cutting concerns and give clients one stable entry point.",
      tradeoff: "The gateway is now a critical, shared dependency for everything.",
    },
    {
      id: "stage3",
      title: "Gateway + service mesh",
      description: "For internal service-to-service traffic, add a service mesh so the gateway only handles north-south (external) traffic.",
      nodes: ["Client", "API Gateway", "Service Mesh", "Internal Services"],
      problem: "As the number of internal services grows, service-to-service auth and retries become their own problem.",
      solution: "A sidecar mesh (e.g. Envoy) handles internal traffic policy, leaving the gateway focused on external requests.",
      tradeoff: "Meaningfully more infrastructure to operate and understand.",
    },
  ],
  relatedTopics: ["load-balancer", "rate-limiting", "microservices", "reverse-proxy", "circuit-breaker"],
};
