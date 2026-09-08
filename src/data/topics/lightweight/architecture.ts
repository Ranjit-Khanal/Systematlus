import type { Topic } from "@/types/topic";

export const architectureLightweight: Topic[] = [
  {
    id: "client-server-architecture",
    title: "Client-Server Architecture",
    category: "architecture",
    difficulty: "beginner",
    isDeepDive: false,
    description:
      "The client (browser, mobile app) requests things; the server (an API) responds to them. Almost every backend system builds on this simple split of responsibilities.",
    concepts: ["Client", "Server", "Request/Response", "Stateless"],
    relatedTopics: ["http", "rest", "api-gateway"],
  },
  {
    id: "monolith",
    title: "Monolith",
    category: "architecture",
    difficulty: "beginner",
    isDeepDive: false,
    description:
      "A monolith is a single deployable application containing all of a system's logic — one codebase, one build, one deploy. Simple to develop and reason about, until the team or codebase outgrows it.",
    concepts: ["Single Deployment", "Shared Database", "Modular Monolith"],
    relatedTopics: ["microservices", "api-gateway"],
  },
  {
    id: "microservices",
    title: "Microservices",
    category: "architecture",
    difficulty: "intermediate",
    isDeepDive: false,
    description:
      "Microservices split a system into small, independently deployable services, each owning its own data. This buys independent scaling and deployment at the cost of network calls replacing function calls.",
    concepts: ["Service Boundaries", "Independent Deployment", "Distributed System"],
    relatedTopics: ["api-gateway", "service-discovery", "monolith", "event-driven-architecture"],
  },
  {
    id: "service-discovery",
    title: "Service Discovery",
    category: "architecture",
    difficulty: "intermediate",
    isDeepDive: false,
    description:
      "In a system with many service instances coming and going, service discovery is how one service finds the current network address of another, instead of relying on a hardcoded list.",
    concepts: ["Service Registry", "Health Checks", "DNS-based Discovery"],
    relatedTopics: ["microservices", "load-balancer", "health-checks"],
  },
  {
    id: "reverse-proxy",
    title: "Reverse Proxy",
    category: "architecture",
    difficulty: "beginner",
    isDeepDive: false,
    description:
      "A reverse proxy sits in front of backend servers and forwards client requests to them, often adding TLS termination, caching, or compression along the way. A load balancer is a reverse proxy specialized for distributing load.",
    concepts: ["TLS Termination", "Forward vs Reverse Proxy", "NGINX"],
    relatedTopics: ["load-balancer", "api-gateway", "cdn"],
  },
];
