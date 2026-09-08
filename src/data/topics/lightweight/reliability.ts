import type { Topic } from "@/types/topic";

export const reliabilityLightweight: Topic[] = [
  {
    id: "circuit-breaker",
    title: "Circuit Breaker",
    category: "reliability",
    difficulty: "intermediate",
    isDeepDive: false,
    description:
      "A circuit breaker stops calling a failing downstream service after enough errors, failing fast instead of piling up slow, doomed requests — then periodically tests if it has recovered.",
    concepts: ["Open/Closed/Half-Open", "Fail Fast", "Fallback"],
    relatedTopics: ["retry", "timeout", "rate-limiting"],
  },
  {
    id: "timeout",
    title: "Timeout",
    category: "reliability",
    difficulty: "beginner",
    isDeepDive: false,
    description:
      "A timeout gives up waiting on a slow dependency after a fixed duration, freeing up resources instead of waiting indefinitely for a response that may never come.",
    concepts: ["Request Timeout", "Connection Timeout", "Resource Exhaustion"],
    relatedTopics: ["circuit-breaker", "connection-pooling"],
  },
  {
    id: "fault-tolerance",
    title: "Fault Tolerance",
    category: "reliability",
    difficulty: "intermediate",
    isDeepDive: false,
    description:
      "A fault-tolerant system keeps working correctly even when some of its components fail — through redundancy, retries, and graceful degradation rather than assuming nothing ever breaks.",
    concepts: ["Redundancy", "Graceful Degradation", "Failover"],
    relatedTopics: ["graceful-degradation", "disaster-recovery", "availability"],
  },
  {
    id: "graceful-degradation",
    title: "Graceful Degradation",
    category: "reliability",
    difficulty: "intermediate",
    isDeepDive: false,
    description:
      "Graceful degradation means a system keeps functioning, in a reduced form, when part of it fails — showing cached data instead of nothing, or disabling a non-critical feature rather than the whole page.",
    concepts: ["Fallback Behavior", "Feature Flags", "Partial Failure"],
    relatedTopics: ["fault-tolerance", "circuit-breaker", "redis"],
  },
  {
    id: "health-checks",
    title: "Health Checks",
    category: "reliability",
    difficulty: "beginner",
    isDeepDive: false,
    description:
      "A health check endpoint lets infrastructure (load balancers, orchestrators) ask a service 'are you okay?' and automatically remove it from rotation if the answer is no.",
    concepts: ["Liveness vs Readiness", "Polling Interval", "Auto-recovery"],
    relatedTopics: ["load-balancer", "service-discovery"],
  },
  {
    id: "disaster-recovery",
    title: "Disaster Recovery",
    category: "reliability",
    difficulty: "advanced",
    isDeepDive: false,
    description:
      "Disaster recovery is the plan for restoring service after a major failure — a whole region going down, or catastrophic data loss — measured by RTO (how fast you recover) and RPO (how much data you can afford to lose).",
    concepts: ["RTO", "RPO", "Backups", "Multi-region Failover"],
    relatedTopics: ["database-replication", "fault-tolerance"],
  },
];
