import type { Topic } from "@/types/topic";

export const loadBalancer: Topic = {
  id: "load-balancer",
  title: "Load Balancer",
  category: "architecture",
  difficulty: "beginner",
  isDeepDive: true,
  description:
    "A load balancer sits in front of your servers and spreads incoming requests across them, so no single server gets overwhelmed.",
  concepts: [
    "Load Balancer",
    "Round Robin",
    "Least Connections",
    "Health Checks",
    "Layer 4 vs Layer 7",
    "Sticky Sessions",
  ],
  howItWorks: [
    "A client sends a request to a single, stable address — the load balancer's IP or domain — instead of talking to a specific server.",
    "The load balancer picks one healthy backend server using a strategy such as round robin, least connections, or weighted routing.",
    "It forwards the request to that server, waits for the response, and relays it back to the client. The client never knows which server handled it.",
    "In the background, the load balancer continuously health-checks every backend. Servers that stop responding are removed from rotation until they recover.",
  ],
  architecture: [
    { id: "client", label: "Client", role: "client", x: 60, y: 200, summary: "Browser or mobile app making requests." },
    { id: "lb", label: "Load Balancer", role: "loadbalancer", x: 320, y: 200, summary: "Distributes traffic across servers.",
      detail: {
        role: "Traffic distributor",
        why: "A single server can only handle so many concurrent connections. The load balancer spreads load and hides backend topology from clients.",
        input: "HTTP request from client",
        output: "Forwarded request to a chosen backend",
        operations: ["Health check", "Route (round robin / least connections)", "TLS termination"],
        failure: "If the load balancer itself goes down, every backend becomes unreachable — this is why production setups usually run at least two load balancers behind a DNS or floating-IP failover.",
        related: ["api-gateway", "reverse-proxy", "health-checks"],
      },
    },
    { id: "api1", label: "API Server 1", role: "service", x: 620, y: 90, summary: "One of several identical backend instances." },
    { id: "api2", label: "API Server 2", role: "service", x: 620, y: 200 },
    { id: "api3", label: "API Server 3", role: "service", x: 620, y: 310 },
  ],
  edges: [
    { id: "e1", source: "client", target: "lb", kind: "sync", label: "HTTPS" },
    { id: "e2", source: "lb", target: "api1", kind: "sync" },
    { id: "e3", source: "lb", target: "api2", kind: "sync", label: "chosen" },
    { id: "e4", source: "lb", target: "api3", kind: "sync" },
  ],
  requestFlow: [
    { id: "s1", nodeId: "client", title: "Client sends a request", description: "The client connects to the load balancer's address — it has no idea how many servers exist behind it.", latencyMs: 1 },
    { id: "s2", nodeId: "lb", title: "Load balancer picks a server", description: "Using round robin (or least-connections), the load balancer selects a healthy backend and opens a connection to it.", operation: "route: least-connections", latencyMs: 1 },
    { id: "s3", nodeId: "api2", title: "API server handles the request", description: "API Server 2 processes the request as if it were the only server that exists.", operation: "GET /orders/42", outcome: "200 OK", latencyMs: 40 },
    { id: "s4", nodeId: "lb", title: "Response passes back through", description: "The load balancer relays the response to the client and records the connection as closed for its load-tracking.", latencyMs: 1 },
  ],
  implementations: [
    {
      id: "nginx-lb",
      filename: "nginx.conf",
      language: "nginx",
      description: "A minimal NGINX config balancing across three upstream API servers using least-connections.",
      relatedNodes: ["lb", "api1", "api2", "api3"],
      code: `upstream api_servers {
    least_conn;
    server 10.0.0.11:4000;
    server 10.0.0.12:4000;
    server 10.0.0.13:4000;
}

server {
    listen 443 ssl;

    location / {
        proxy_pass http://api_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}`,
    },
    {
      id: "health-check",
      filename: "health.route.ts",
      language: "TypeScript",
      description: "Each backend exposes a health endpoint the load balancer polls every few seconds.",
      relatedNodes: ["api1"],
      code: `app.get("/health", async (_req, res) => {
  const dbOk = await db.ping();
  if (!dbOk) return res.status(503).json({ status: "degraded" });
  res.status(200).json({ status: "ok" });
});`,
    },
  ],
  tradeoffs: {
    advantages: [
      "Horizontal scaling — add more servers without touching client code",
      "No single server is a single point of failure",
      "Enables zero-downtime deploys (drain one server, update, repeat)",
    ],
    disadvantages: [
      "One more network hop and one more component to operate",
      "Sticky sessions (routing a user to the same server) add state and complexity",
      "The load balancer itself must be made highly available",
    ],
    whenToUse:
      "Use a load balancer as soon as you run more than one instance of a service — which is almost always true once traffic or reliability requirements grow beyond a single machine.",
  },
  failureModes: [
    {
      id: "backend-down",
      title: "A backend server crashes",
      scenario: "API Server 2 stops responding to health checks.",
      path: ["client", "lb", "api2"],
      explanation:
        "The load balancer marks API Server 2 unhealthy after a few failed checks and stops routing new requests to it. In-flight requests to it fail, but new requests go to API Server 1 or 3.",
      consequences: [
        "Brief error spike for requests that were mid-flight to the failed server",
        "Remaining servers absorb extra load until capacity is added back",
      ],
    },
    {
      id: "lb-down",
      title: "The load balancer itself goes down",
      scenario: "A single load balancer instance fails.",
      path: ["client", "lb"],
      explanation:
        "Every backend becomes unreachable, even though they're healthy — clients can't find them. This is why the load balancer is usually the one component that gets active-active redundancy with a floating IP or DNS failover.",
      consequences: ["Full outage until the standby load balancer takes over", "Highlights why the LB tier needs its own redundancy plan"],
    },
  ],
  scaling: [
    {
      id: "stage1",
      title: "Single server",
      description: "One API server handles everything directly.",
      nodes: ["Client", "API Server", "Database"],
      problem: "Works fine until traffic exceeds what one machine can handle, or the server needs a restart.",
    },
    {
      id: "stage2",
      title: "Add a load balancer",
      description: "Introduce a load balancer and run multiple identical API instances.",
      nodes: ["Client", "Load Balancer", "API × 3", "Database"],
      problem: "Traffic growth and the need for zero-downtime deploys.",
      solution: "Distribute requests across N identical servers.",
      tradeoff: "Requires servers to be stateless, or sessions to be shared (e.g. in Redis).",
    },
    {
      id: "stage3",
      title: "Multi-region",
      description: "Add regional load balancers behind global DNS/anycast routing so traffic hits the nearest region.",
      nodes: ["Global DNS", "Regional LB (US)", "Regional LB (EU)", "API clusters", "Database"],
      problem: "Users far from your single region see high latency; a regional outage takes down everyone.",
      solution: "Route users to the nearest healthy region.",
      tradeoff: "Data now needs to be replicated or partitioned across regions, adding significant complexity.",
    },
  ],
  relatedTopics: ["api-gateway", "reverse-proxy", "health-checks", "consistent-hashing", "circuit-breaker"],
};
