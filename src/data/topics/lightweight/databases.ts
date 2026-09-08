import type { Topic } from "@/types/topic";

export const databasesLightweight: Topic[] = [
  {
    id: "postgresql",
    title: "PostgreSQL",
    category: "databases",
    difficulty: "beginner",
    isDeepDive: false,
    description:
      "PostgreSQL is an open-source relational database known for strong consistency guarantees, rich SQL support, and extensibility. It's a common default choice for systems that need real transactions.",
    concepts: ["Relational Model", "ACID", "Extensions"],
    relatedTopics: ["database-transactions", "postgresql-indexing", "mysql"],
  },
  {
    id: "mysql",
    title: "MySQL",
    category: "databases",
    difficulty: "beginner",
    isDeepDive: false,
    description:
      "MySQL is another widely used open-source relational database, historically popular for web applications. It offers similar relational guarantees to PostgreSQL with different internals and tooling.",
    concepts: ["Relational Model", "InnoDB", "Replication"],
    relatedTopics: ["postgresql", "database-replication"],
  },
  {
    id: "sql-vs-nosql",
    title: "SQL vs NoSQL",
    category: "databases",
    difficulty: "beginner",
    isDeepDive: false,
    description:
      "SQL databases enforce a fixed schema and strong relational guarantees. NoSQL databases trade some of that structure and consistency for flexible schemas and easier horizontal scaling.",
    concepts: ["Schema Flexibility", "Horizontal Scaling", "Consistency Guarantees"],
    relatedTopics: ["postgresql", "eventual-consistency", "database-sharding"],
  },
  {
    id: "optimistic-locking",
    title: "Optimistic Locking",
    category: "databases",
    difficulty: "intermediate",
    isDeepDive: false,
    description:
      "Optimistic locking assumes conflicts are rare: read data with its version, write only if the version hasn't changed, and reject (rather than block) if it has.",
    concepts: ["Version Column", "Compare-and-Swap", "Retry on Conflict"],
    relatedTopics: ["database-locking", "pessimistic-locking"],
  },
  {
    id: "pessimistic-locking",
    title: "Pessimistic Locking",
    category: "databases",
    difficulty: "intermediate",
    isDeepDive: false,
    description:
      "Pessimistic locking assumes conflicts are likely: lock the row before anyone can change it, forcing competing transactions to wait their turn.",
    concepts: ["SELECT FOR UPDATE", "Row Locks", "Blocking"],
    relatedTopics: ["database-locking", "optimistic-locking", "booking-system"],
  },
  {
    id: "read-replicas",
    title: "Read Replicas",
    category: "databases",
    difficulty: "intermediate",
    isDeepDive: false,
    description:
      "Read replicas are copies of a primary database that serve read-only queries, letting read capacity scale independently of write capacity.",
    concepts: ["Read/Write Split", "Replication Lag", "Failover"],
    relatedTopics: ["database-replication", "eventual-consistency"],
  },
  {
    id: "database-sharding",
    title: "Database Sharding",
    category: "databases",
    difficulty: "advanced",
    isDeepDive: false,
    description:
      "Sharding splits one large dataset across multiple independent databases (shards), each holding a subset of rows — usually by a key like customer ID — so no single machine has to store or serve it all.",
    concepts: ["Shard Key", "Partitioning", "Cross-shard Queries", "Rebalancing"],
    relatedTopics: ["partitioning", "consistent-hashing", "database-replication"],
  },
  {
    id: "partitioning",
    title: "Partitioning",
    category: "databases",
    difficulty: "intermediate",
    isDeepDive: false,
    description:
      "Partitioning splits a single logical table into smaller physical pieces — often by date range or a hash of a key — so queries and maintenance only touch the relevant slice.",
    concepts: ["Range Partitioning", "Hash Partitioning", "Partition Pruning"],
    relatedTopics: ["database-sharding", "postgresql-indexing"],
  },
  {
    id: "consistent-hashing",
    title: "Consistent Hashing",
    category: "databases",
    difficulty: "advanced",
    isDeepDive: false,
    description:
      "Consistent hashing maps keys to nodes in a way that, when a node is added or removed, only a small fraction of keys need to move — instead of reshuffling everything.",
    concepts: ["Hash Ring", "Virtual Nodes", "Minimal Remapping"],
    relatedTopics: ["database-sharding", "distributed-cache", "load-balancer"],
  },
];
