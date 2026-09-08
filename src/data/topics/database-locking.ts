import type { Topic } from "@/types/topic";

export const databaseLocking: Topic = {
  id: "database-locking",
  title: "Database Locking",
  category: "databases",
  difficulty: "intermediate",
  isDeepDive: true,
  description:
    "Database locking stops two concurrent transactions from stepping on the same row at the same time — without it, the last write silently wins and the other one vanishes.",
  concepts: [
    "Race Condition",
    "Optimistic Locking",
    "Pessimistic Locking",
    "SELECT FOR UPDATE",
    "Deadlocks",
    "Row-level Locks",
  ],
  howItWorks: [
    "Two requests read the same row at nearly the same time, both decide it's safe to proceed, and both write — one overwrite silently erases the other's work. This is a race condition.",
    "Pessimistic locking prevents this by having the first transaction lock the row (SELECT ... FOR UPDATE), forcing the second transaction to wait until the first commits or rolls back.",
    "Optimistic locking takes the opposite bet: don't lock anything, but check a version number when writing. If the version changed since you read it, reject the write and let the caller retry.",
    "Which one you pick depends on contention: pessimistic locking suits hot, contested rows (a concert seat); optimistic locking suits data that's rarely fought over (a user profile edit).",
  ],
  architecture: [
    { id: "userA", label: "User A", role: "client", x: 20, y: 100 },
    { id: "userB", label: "User B", role: "client", x: 20, y: 280 },
    { id: "api", label: "Booking API", role: "service", x: 300, y: 190, summary: "Handles seat reservation requests.",
      detail: {
        role: "Application server",
        why: "Coordinates the read-check-write sequence and decides which locking strategy to apply.",
        input: "POST /bookings { seatId }",
        output: "Booking confirmed or rejected",
        operations: ["SELECT FOR UPDATE", "UPDATE", "COMMIT"],
        related: ["database-transactions"],
      },
    },
    { id: "db", label: "PostgreSQL", role: "database", x: 620, y: 190, summary: "Holds the row lock during the transaction.",
      detail: {
        role: "Lock owner",
        why: "The database is the only party that can guarantee mutual exclusion on a row across concurrent connections.",
        input: "SELECT ... FOR UPDATE",
        output: "Exclusive row lock until COMMIT/ROLLBACK",
        operations: ["Acquire row lock", "Block competing transaction", "Release on commit"],
        failure: "If a transaction holding a lock never commits (e.g. crashed connection), the lock is held until the connection times out — a resource leak risk.",
        related: ["database-transactions"],
      },
    },
  ],
  edges: [
    { id: "e1", source: "userA", target: "api", kind: "sync", label: "book seat 12" },
    { id: "e2", source: "userB", target: "api", kind: "sync", label: "book seat 12" },
    { id: "e3", source: "api", target: "db", kind: "sync" },
  ],
  requestFlow: [
    { id: "s1", nodeId: "userA", title: "User A requests seat 12", description: "Two users click 'book' on the same seat within milliseconds of each other.", operation: "POST /bookings { seatId: 12 }" },
    { id: "s2", nodeId: "api", title: "Transaction begins, row is locked", description: "User A's request starts a transaction and locks the seat row so no one else can read it for update until this transaction ends.", operation: "SELECT * FROM seats WHERE id = 12 FOR UPDATE" },
    { id: "s3", nodeId: "userB", title: "User B's request must wait", description: "User B's identical request tries to lock the same row and blocks — PostgreSQL makes it wait rather than letting both proceed.", operation: "SELECT * FROM seats WHERE id = 12 FOR UPDATE (blocked)" },
    { id: "s4", nodeId: "db", title: "User A's booking commits", description: "Seat 12 is marked booked and the transaction commits, releasing the lock.", operation: "UPDATE seats SET status = 'booked' ... COMMIT", outcome: "seat 12 → booked" },
    { id: "s5", nodeId: "api", title: "User B's request resumes — and fails safely", description: "Now unblocked, User B's transaction sees the seat is already booked and returns a conflict instead of double-booking it.", outcome: "409 Conflict: seat already booked" },
  ],
  implementations: [
    {
      id: "pessimistic",
      filename: "booking.service.ts",
      language: "TypeScript",
      description: "Pessimistic locking: lock the row first, so the second request simply waits and then sees the updated state.",
      relatedNodes: ["api", "db"],
      code: `await db.transaction(async (tx) => {
  const seat = await tx.query(
    "SELECT * FROM seats WHERE id = $1 FOR UPDATE",
    [seatId],
  );

  if (seat.status === "booked") {
    throw new ConflictError("Seat already booked");
  }

  await tx.query(
    "UPDATE seats SET status = 'booked', user_id = $1 WHERE id = $2",
    [userId, seatId],
  );
});`,
    },
    {
      id: "optimistic",
      filename: "profile.service.ts",
      language: "TypeScript",
      description: "Optimistic locking: no lock is held. The UPDATE only succeeds if the version hasn't changed since it was read.",
      relatedNodes: ["api", "db"],
      code: `const profile = await db.query(
  "SELECT * FROM profiles WHERE id = $1",
  [id],
);

const result = await db.query(
  \`UPDATE profiles
   SET bio = $1, version = version + 1
   WHERE id = $2 AND version = $3\`,
  [newBio, id, profile.version],
);

if (result.rowCount === 0) {
  throw new ConflictError("Profile changed — please retry");
}`,
    },
  ],
  database: {
    tables: [
      {
        name: "seats",
        columns: [
          { name: "id", type: "bigint", isPrimaryKey: true },
          { name: "event_id", type: "bigint", isForeignKey: true, isIndexed: true },
          { name: "status", type: "text", note: "'available' | 'booked'" },
          { name: "user_id", type: "bigint", isForeignKey: true },
        ],
        exampleRows: [
          { id: 12, event_id: 1, status: "booked", user_id: 501 },
          { id: 13, event_id: 1, status: "available", user_id: "" },
        ],
      },
      {
        name: "profiles",
        columns: [
          { name: "id", type: "bigint", isPrimaryKey: true },
          { name: "bio", type: "text" },
          { name: "version", type: "int", note: "incremented on every update — powers optimistic locking" },
        ],
      },
    ],
  },
  tradeoffs: {
    advantages: [
      "Pessimistic: guarantees no conflicting write ever gets through — simple to reason about for hot rows",
      "Optimistic: no lock held, so it scales better under low contention",
      "Both prevent the silent lost-update problem of unguarded concurrent writes",
    ],
    disadvantages: [
      "Pessimistic: contested rows serialize requests, hurting throughput; risk of deadlocks with multiple locks",
      "Optimistic: under high contention, most requests fail and must retry, wasting work",
      "Both add code complexity compared to a naive read-then-write",
    ],
    whenToUse:
      "Use pessimistic locking (SELECT FOR UPDATE) for scarce, hotly-contested resources like a concert seat or an inventory unit. Use optimistic locking (a version column) for data that's read often but rarely edited concurrently, like a user profile.",
  },
  failureModes: [
    {
      id: "deadlock",
      title: "Deadlock from inconsistent lock order",
      scenario: "Transaction 1 locks seat 12 then tries to lock seat 13. Transaction 2 locks seat 13 then tries to lock seat 12.",
      path: ["api", "db"],
      explanation: "Each transaction waits on a lock the other holds. PostgreSQL detects the cycle and kills one transaction to break it.",
      consequences: ["One request fails with a deadlock error and must retry", "Fix: always acquire locks in a consistent order (e.g. sort by seat id)"],
    },
    {
      id: "lock-held-too-long",
      title: "A lock is held too long",
      scenario: "The API does slow work (e.g. calling a payment provider) while still holding the row lock.",
      path: ["api", "db"],
      explanation: "Every other request for that row queues up behind the slow one, even though the actual database work is fast.",
      consequences: ["Requests pile up and time out", "Best practice: do slow I/O before or after the locked transaction, never during it"],
    },
  ],
  scaling: [
    {
      id: "stage1",
      title: "No locking",
      description: "Read the row, decide in application code, then write.",
      nodes: ["API", "PostgreSQL"],
      problem: "Two concurrent requests can both read 'available' and both book the same seat.",
    },
    {
      id: "stage2",
      title: "Add row-level locking",
      description: "Use SELECT FOR UPDATE (pessimistic) or a version column (optimistic) to prevent the race.",
      nodes: ["API", "Row lock / version check", "PostgreSQL"],
      solution: "Only one transaction can win the contested row; the other is rejected or made to wait.",
      tradeoff: "Pessimistic locking reduces throughput on hot rows.",
    },
    {
      id: "stage3",
      title: "Distributed locking",
      description: "When the resource isn't in a single database (e.g. coordinating across microservices), move to a distributed lock.",
      nodes: ["Service A", "Distributed Lock (Redis/etcd)", "Service B"],
      problem: "No single database transaction spans multiple services.",
      solution: "Use a distributed lock service to coordinate exclusivity across processes.",
      tradeoff: "Distributed locks are harder to make correct — see Distributed Locks.",
    },
  ],
  relatedTopics: ["distributed-locks", "database-transactions", "optimistic-locking", "pessimistic-locking", "consistent-hashing"],
};
