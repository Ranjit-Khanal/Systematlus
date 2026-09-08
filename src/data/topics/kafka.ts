import type { Topic } from "@/types/topic";

export const kafka: Topic = {
  id: "kafka",
  title: "Kafka",
  category: "messaging",
  difficulty: "advanced",
  isDeepDive: false,
  description:
    "Kafka is a distributed log: producers append events to it, and consumers read through them independently, at their own pace — even long after the event was written.",
  concepts: ["Producer", "Topic", "Partition", "Consumer Group", "Offset", "Consumer Lag"],
  howItWorks: [
    "Producers write events to a topic — a named stream, like 'order.created'.",
    "Each topic is split into partitions, which are ordered, append-only logs. Splitting lets Kafka parallelize both writes and reads across many machines.",
    "Consumers are organized into consumer groups. Kafka assigns each partition in a topic to exactly one consumer within a group, so the group as a whole processes every event exactly once, in parallel.",
    "Each consumer tracks an offset — the position it has read up to in a partition. If a consumer falls behind the rate of production, that gap is called consumer lag.",
  ],
  architecture: [
    { id: "producer", label: "Producer", role: "service", x: 20, y: 200, summary: "Publishes events to a topic." },
    { id: "topic", label: "Topic: order.created", role: "queue", x: 280, y: 200, summary: "A named, partitioned log.",
      detail: {
        role: "Append-only log",
        why: "Decouples producers from consumers — producers don't need to know who's reading, or when.",
        input: "produce(event)",
        output: "Ordered log split across partitions",
        operations: ["append", "read by offset"],
        related: ["message-queues", "pub-sub"],
      },
    },
    { id: "p0", label: "Partition 0", role: "storage", x: 540, y: 80 },
    { id: "p1", label: "Partition 1", role: "storage", x: 540, y: 200 },
    { id: "p2", label: "Partition 2", role: "storage", x: 540, y: 320 },
    { id: "cg", label: "Consumer Group: billing", role: "service", x: 800, y: 200, summary: "One consumer per partition, working in parallel.",
      detail: {
        role: "Coordinated consumer set",
        why: "Kafka guarantees each partition is read by only one consumer in a group at a time, giving ordered, parallel, exactly-once-per-group processing.",
        input: "poll(topic)",
        output: "Batch of events since last committed offset",
        failure: "If a consumer falls behind, lag grows — monitored as consumer lag, a key operational metric.",
        related: ["consumer-groups", "backpressure"],
      },
    },
  ],
  edges: [
    { id: "e1", source: "producer", target: "topic", kind: "async", label: "produce" },
    { id: "e2", source: "topic", target: "p0", kind: "sync" },
    { id: "e3", source: "topic", target: "p1", kind: "sync" },
    { id: "e4", source: "topic", target: "p2", kind: "sync" },
    { id: "e5", source: "p0", target: "cg", kind: "async", label: "consume" },
    { id: "e6", source: "p1", target: "cg", kind: "async", label: "consume" },
    { id: "e7", source: "p2", target: "cg", kind: "async", label: "consume" },
  ],
  requestFlow: [
    { id: "s1", nodeId: "producer", title: "An order is placed", description: "The Orders service publishes an event instead of calling the Billing service directly.", operation: "produce('order.created', { orderId: 42 })" },
    { id: "s2", nodeId: "topic", title: "Kafka appends it to a partition", description: "Based on a partition key (often the order or customer ID), the event is written to one specific partition to preserve per-key ordering.", operation: "partition = hash(orderId) % 3" },
    { id: "s3", nodeId: "p1", title: "Event lands in Partition 1", description: "The event is now durably stored, in order, alongside other events for that partition." },
    { id: "s4", nodeId: "cg", title: "Billing service consumes it", description: "The consumer assigned to Partition 1 reads the event and processes it — charging the customer.", operation: "poll() → process → commit offset", outcome: "processed" },
  ],
  implementations: [
    {
      id: "producer-code",
      filename: "orders.producer.ts",
      language: "TypeScript",
      description: "Publishing an event with a partition key so all events for the same order stay ordered.",
      relatedNodes: ["producer", "topic"],
      code: `await kafka.producer().send({
  topic: "order.created",
  messages: [
    {
      key: String(order.id),
      value: JSON.stringify(order),
    },
  ],
});`,
    },
    {
      id: "consumer-code",
      filename: "billing.consumer.ts",
      language: "TypeScript",
      description: "A consumer in the 'billing' group processes events and commits its offset only after successful processing.",
      relatedNodes: ["cg"],
      code: `const consumer = kafka.consumer({ groupId: "billing" });
await consumer.subscribe({ topic: "order.created" });

await consumer.run({
  eachMessage: async ({ message }) => {
    const order = JSON.parse(message.value!.toString());
    await chargeCustomer(order);
    // Offset committed automatically after this returns
    // successfully (with autoCommit) — or manually for
    // stronger guarantees.
  },
});`,
    },
  ],
  tradeoffs: {
    advantages: [
      "Decouples producers and consumers completely — services don't need to know about each other",
      "Extremely high throughput; partitions let both writes and reads scale horizontally",
      "Events are durably stored and replayable — a new consumer can start from the beginning",
    ],
    disadvantages: [
      "Operationally heavier than a simple queue — brokers, partitions, and consumer groups all need monitoring",
      "Ordering is only guaranteed within a partition, not across an entire topic",
      "Consumer lag under sustained high load requires active capacity planning",
    ],
    whenToUse:
      "Reach for Kafka when you need high-throughput event streaming with replay and multiple independent consumer groups reading the same events — analytics pipelines, event sourcing, or fanning out one event to many services. For simple task queues, a lighter message queue is usually enough.",
  },
  failureModes: [
    {
      id: "consumer-lag",
      title: "Consumer lag grows unbounded",
      scenario: "The billing consumer group processes events slower than the producer publishes them.",
      path: ["producer", "topic", "cg"],
      explanation: "The gap between the latest produced offset and the consumer's committed offset keeps growing. Events are still safely stored, but processing falls further and further behind real-time.",
      consequences: ["Delayed downstream effects (e.g. delayed billing)", "Usually fixed by adding more consumer instances, up to one per partition"],
    },
    {
      id: "duplicate-processing",
      title: "Duplicate message processing",
      scenario: "A consumer crashes after processing a message but before committing its offset.",
      path: ["cg"],
      explanation: "On restart, the consumer resumes from the last committed offset and reprocesses the message it had already handled.",
      consequences: ["Downstream side effects (like charging a customer) can happen twice unless the consumer logic is idempotent"],
    },
  ],
  scaling: [
    {
      id: "stage1",
      title: "Direct service-to-service calls",
      description: "Orders service calls Billing service synchronously.",
      nodes: ["Orders Service", "Billing Service"],
      problem: "Tight coupling — if Billing is slow or down, order creation fails too.",
    },
    {
      id: "stage2",
      title: "Introduce Kafka",
      description: "Orders publishes events; Billing (and others) consume independently.",
      nodes: ["Orders Service", "Kafka Topic", "Billing Consumer Group"],
      solution: "Services are decoupled in time and availability.",
      tradeoff: "Eventual rather than immediate processing; more infrastructure.",
    },
    {
      id: "stage3",
      title: "Multiple consumer groups",
      description: "Add Analytics and Fraud-Detection as separate consumer groups reading the same topic independently.",
      nodes: ["Kafka Topic", "Billing Group", "Analytics Group", "Fraud Group"],
      problem: "New use cases need the same event stream without affecting existing consumers.",
      solution: "Kafka's log model lets any number of independent groups read the same data at their own pace.",
      tradeoff: "More consumers to monitor for lag; broker load grows with fan-out.",
    },
  ],
  relatedTopics: ["message-queues", "pub-sub", "consumer-groups", "event-driven-architecture", "backpressure"],
};
