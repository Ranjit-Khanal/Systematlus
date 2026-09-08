import type { Topic } from "@/types/topic";

export const messagingLightweight: Topic[] = [
  {
    id: "message-queues",
    title: "Message Queues",
    category: "messaging",
    difficulty: "intermediate",
    isDeepDive: false,
    description:
      "A message queue lets a producer hand off work to be processed later, by a separate consumer, without either side waiting on the other directly.",
    concepts: ["Producer/Consumer", "At-least-once Delivery", "Visibility Timeout"],
    relatedTopics: ["rabbitmq", "kafka", "job-queue", "backpressure"],
  },
  {
    id: "rabbitmq",
    title: "RabbitMQ",
    category: "messaging",
    difficulty: "intermediate",
    isDeepDive: false,
    description:
      "RabbitMQ is a traditional message broker built around exchanges and queues — well suited for task distribution and routing, as opposed to Kafka's log-based replay model.",
    concepts: ["Exchanges", "Queues", "Routing Keys"],
    relatedTopics: ["message-queues", "kafka", "pub-sub"],
  },
  {
    id: "pub-sub",
    title: "Pub/Sub",
    category: "messaging",
    difficulty: "intermediate",
    isDeepDive: false,
    description:
      "In a publish/subscribe system, publishers emit events without knowing who (if anyone) is listening, and any number of subscribers can independently receive them.",
    concepts: ["Topics/Channels", "Decoupling", "Fan-out"],
    relatedTopics: ["kafka", "event-driven-architecture", "cache-invalidation"],
  },
  {
    id: "consumer-groups",
    title: "Consumer Groups",
    category: "messaging",
    difficulty: "advanced",
    isDeepDive: false,
    description:
      "A consumer group is a set of consumers that split the work of reading a topic between them, so each message is processed once by the group as a whole, while multiple groups can each independently process everything.",
    concepts: ["Partition Assignment", "Offset Commit", "Rebalancing"],
    relatedTopics: ["kafka", "backpressure"],
  },
  {
    id: "event-driven-architecture",
    title: "Event-Driven Architecture",
    category: "messaging",
    difficulty: "advanced",
    isDeepDive: false,
    description:
      "In an event-driven architecture, services communicate by publishing facts about what happened (events) rather than calling each other directly — reacting to events as they arrive.",
    concepts: ["Events vs Commands", "Loose Coupling", "Eventual Consistency"],
    relatedTopics: ["kafka", "pub-sub", "microservices", "eventual-consistency"],
  },
  {
    id: "retry",
    title: "Retry",
    category: "messaging",
    difficulty: "beginner",
    isDeepDive: false,
    description:
      "Retrying a failed operation — usually with exponential backoff — handles transient failures gracefully, but only works safely if the operation is idempotent.",
    concepts: ["Exponential Backoff", "Jitter", "Idempotency"],
    relatedTopics: ["idempotency", "circuit-breaker", "dead-letter-queue"],
  },
  {
    id: "dead-letter-queue",
    title: "Dead Letter Queue",
    category: "messaging",
    difficulty: "intermediate",
    isDeepDive: false,
    description:
      "A dead letter queue holds messages that repeatedly fail processing, so they don't block the main queue or get silently dropped — they wait for investigation or manual replay.",
    concepts: ["Poison Messages", "Max Retry Count", "Manual Replay"],
    relatedTopics: ["message-queues", "retry"],
  },
  {
    id: "backpressure",
    title: "Backpressure",
    category: "messaging",
    difficulty: "advanced",
    isDeepDive: false,
    description:
      "Backpressure is a signal from a slow consumer telling a fast producer to slow down, preventing unbounded queues, memory exhaustion, or cascading overload.",
    concepts: ["Flow Control", "Bounded Queues", "Consumer Lag"],
    relatedTopics: ["message-queues", "kafka", "rate-limiting"],
  },
];
