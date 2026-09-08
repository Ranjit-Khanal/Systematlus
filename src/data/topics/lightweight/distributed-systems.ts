import type { Topic } from "@/types/topic";

export const distributedSystemsLightweight: Topic[] = [
  {
    id: "cap-theorem",
    title: "CAP Theorem",
    category: "distributed-systems",
    difficulty: "advanced",
    isDeepDive: false,
    description:
      "CAP theorem says a distributed system can't simultaneously guarantee Consistency, Availability, and Partition tolerance — when a network partition happens, you must choose between staying consistent or staying available.",
    concepts: ["Consistency", "Availability", "Partition Tolerance"],
    relatedTopics: ["consistency", "availability", "eventual-consistency"],
  },
  {
    id: "consistency",
    title: "Consistency",
    category: "distributed-systems",
    difficulty: "intermediate",
    isDeepDive: false,
    description:
      "Consistency means every read sees the most recent write, no matter which node serves it. Strong consistency is easier to reason about but harder to keep fast and available across regions.",
    concepts: ["Strong Consistency", "Linearizability", "Read-Your-Writes"],
    relatedTopics: ["cap-theorem", "eventual-consistency", "database-replication"],
  },
  {
    id: "availability",
    title: "Availability",
    category: "distributed-systems",
    difficulty: "intermediate",
    isDeepDive: false,
    description:
      "Availability means every request gets a response, even if some nodes are unreachable. Maximizing it often means accepting weaker consistency guarantees during a partition.",
    concepts: ["Uptime", "Graceful Degradation", "Fault Tolerance"],
    relatedTopics: ["cap-theorem", "fault-tolerance", "disaster-recovery"],
  },
  {
    id: "leader-election",
    title: "Leader Election",
    category: "distributed-systems",
    difficulty: "advanced",
    isDeepDive: false,
    description:
      "Leader election lets a group of distributed nodes agree on exactly one of them to coordinate a task, and re-elect a new leader automatically if it fails.",
    concepts: ["Consensus", "Raft", "Split Brain"],
    relatedTopics: ["distributed-locks", "distributed-scheduler"],
  },
  {
    id: "idempotency",
    title: "Idempotency",
    category: "distributed-systems",
    difficulty: "intermediate",
    isDeepDive: false,
    description:
      "An idempotent operation produces the same result no matter how many times it's applied — the property that makes retries safe in an unreliable network.",
    concepts: ["Idempotency Key", "Safe Retries", "PUT vs POST"],
    relatedTopics: ["retry", "payment-system", "distributed-locks"],
  },
  {
    id: "distributed-transactions",
    title: "Distributed Transactions",
    category: "distributed-systems",
    difficulty: "advanced",
    isDeepDive: false,
    description:
      "When a single operation must update data across multiple services or databases, a normal BEGIN/COMMIT no longer applies. Patterns like Sagas and two-phase commit coordinate the outcome instead.",
    concepts: ["Saga Pattern", "Two-Phase Commit", "Compensating Actions"],
    relatedTopics: ["database-transactions", "event-driven-architecture"],
  },
];
