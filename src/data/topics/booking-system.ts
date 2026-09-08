import type { Topic } from "@/types/topic";

export const bookingSystem: Topic = {
  id: "booking-system",
  title: "Booking System",
  category: "real-world-systems",
  difficulty: "intermediate",
  isDeepDive: false,
  description:
    "A booking system's hardest problem isn't the UI — it's making sure two people can't book the exact same seat, room, or table at the exact same moment.",
  concepts: ["Race Condition", "SELECT FOR UPDATE", "Pessimistic Locking", "Transactions", "Idempotency"],
  howItWorks: [
    "A user selects a resource (a seat, a room) and submits a booking request.",
    "The Booking Service opens a database transaction and locks the specific resource row so no other transaction can book it concurrently.",
    "If the resource is still available, it's marked booked and the transaction commits. If another request got there first, this request is rejected.",
    "The lock is held only for the brief moment of the check-and-update — not for the whole user session — to keep the system responsive.",
  ],
  architecture: [
    { id: "client", label: "Client", role: "client", x: 20, y: 200 },
    { id: "api", label: "API", role: "service", x: 280, y: 200 },
    { id: "booking", label: "Booking Service", role: "service", x: 540, y: 200, summary: "Owns the lock-check-write sequence.",
      detail: {
        role: "Transactional coordinator",
        why: "Centralizes the exact logic that prevents double-booking, so it's implemented once and correctly.",
        input: "reserve(resourceId, userId)",
        output: "Confirmed booking or 409 Conflict",
        operations: ["SELECT FOR UPDATE", "UPDATE", "COMMIT"],
        related: ["database-locking", "database-transactions"],
      },
    },
    { id: "db", label: "PostgreSQL", role: "database", x: 820, y: 200, summary: "Holds the row lock during the transaction." },
  ],
  edges: [
    { id: "e1", source: "client", target: "api", kind: "sync" },
    { id: "e2", source: "api", target: "booking", kind: "sync" },
    { id: "e3", source: "booking", target: "db", kind: "sync", label: "SELECT ... FOR UPDATE" },
  ],
  requestFlow: [
    { id: "s1", nodeId: "client", title: "Two users click 'Book' on the same room", description: "User A and User B both try to reserve Room 5 for the same night, within milliseconds.", operation: "POST /bookings { resourceId: 5 }" },
    { id: "s2", nodeId: "booking", title: "First request locks the row", description: "User A's request reaches the Booking Service first and opens a transaction that locks Room 5's row.", operation: "SELECT * FROM resources WHERE id = 5 FOR UPDATE" },
    { id: "s3", nodeId: "db", title: "Second request blocks, then sees the update", description: "User B's transaction tries to lock the same row and must wait. Once User A commits, User B's SELECT FOR UPDATE proceeds and sees the resource is now booked.", outcome: "User A: booked. User B: rejected." },
    { id: "s4", nodeId: "client", title: "Users get their results", description: "User A sees a confirmation. User B sees 'This room was just booked — try another.'", outcome: "409 Conflict for User B" },
  ],
  implementations: [
    {
      id: "booking-sql",
      filename: "reserve.sql",
      language: "sql",
      description: "The row lock at the heart of the whole system.",
      relatedNodes: ["booking", "db"],
      code: `BEGIN;

SELECT *
FROM resources
WHERE id = $1
FOR UPDATE;

-- application checks: is status = 'available'?

UPDATE resources
SET status = 'booked', booked_by = $2
WHERE id = $1;

COMMIT;`,
    },
    {
      id: "booking-service",
      filename: "booking.service.ts",
      language: "TypeScript",
      description: "Why the lock exists: without FOR UPDATE, two concurrent reads could both see 'available' before either write happens.",
      relatedNodes: ["booking", "db"],
      code: `async function reserveResource(resourceId: string, userId: string) {
  return db.transaction(async (tx) => {
    const resource = await tx.query(
      "SELECT * FROM resources WHERE id = $1 FOR UPDATE",
      [resourceId],
    );

    if (resource.status !== "available") {
      throw new ConflictError("Resource already booked");
    }

    await tx.query(
      "UPDATE resources SET status = 'booked', booked_by = $1 WHERE id = $2",
      [userId, resourceId],
    );

    return { resourceId, status: "booked" };
  });
}`,
    },
  ],
  database: {
    tables: [
      {
        name: "resources",
        columns: [
          { name: "id", type: "bigint", isPrimaryKey: true },
          { name: "name", type: "text" },
          { name: "status", type: "text", note: "'available' | 'booked'" },
          { name: "booked_by", type: "bigint", isForeignKey: true },
        ],
        exampleRows: [{ id: 5, name: "Room 5", status: "booked", booked_by: 501 }],
      },
    ],
  },
  tradeoffs: {
    advantages: [
      "SELECT FOR UPDATE guarantees exactly one booking ever succeeds for a given resource and time slot",
      "The lock window is short — held only during the check-and-write, not the whole checkout flow",
      "Failures are explicit and immediate (409 Conflict) rather than silent overwrites",
    ],
    disadvantages: [
      "Extremely popular resources (a single flight's last seat) still serialize requests through one lock",
      "A slow step accidentally placed inside the transaction (like a payment call) would hold the lock far too long",
      "Doesn't by itself handle 'reserve now, pay in 10 minutes' style holds — that needs an explicit expiring reservation state",
    ],
    whenToUse:
      "Use this pattern any time two actors can compete for the same finite, exclusive resource: seats, rooms, inventory units, or time slots. For non-exclusive resources, this locking is unnecessary overhead.",
  },
  failureModes: [
    {
      id: "double-booking-without-lock",
      title: "What happens without the lock",
      scenario: "The application reads the resource status, then writes, with no FOR UPDATE.",
      path: ["client", "api", "db"],
      explanation: "Two requests can both read 'available' before either writes 'booked' — both proceed, and the resource is double-booked.",
      consequences: ["Two customers arrive expecting the same room", "This is exactly the race condition SELECT FOR UPDATE prevents"],
    },
    {
      id: "slow-payment-in-lock",
      title: "A slow step is placed inside the lock",
      scenario: "A developer calls an external payment provider while still holding the row lock.",
      path: ["booking", "db"],
      explanation: "Every other request for that resource queues up behind a slow network call that has nothing to do with the database.",
      consequences: ["Requests time out waiting for an unrelated external service", "Fix: reserve first (short lock), charge after, and roll back the reservation on payment failure"],
    },
  ],
  scaling: [
    {
      id: "stage1",
      title: "Naive read-then-write",
      description: "Check availability, then update, as two separate statements.",
      nodes: ["API", "PostgreSQL"],
      problem: "Race condition: concurrent requests can both pass the availability check.",
    },
    {
      id: "stage2",
      title: "Add row-level locking",
      description: "Wrap the check-and-write in a transaction with SELECT FOR UPDATE.",
      nodes: ["API", "Booking Service", "PostgreSQL (row lock)"],
      solution: "Only one concurrent request can ever win the resource.",
      tradeoff: "Hot resources serialize booking attempts.",
    },
    {
      id: "stage3",
      title: "Temporary holds + queueing",
      description: "For extremely high-demand drops (e.g. concert tickets), add a short-lived 'hold' state and a queue to smooth the initial burst.",
      nodes: ["Client", "Virtual Waiting Queue", "Booking Service", "PostgreSQL"],
      problem: "Thousands of simultaneous requests for a handful of resources create massive lock contention.",
      solution: "Admit requests gradually and hold a resource for a few minutes during checkout.",
      tradeoff: "Significantly more moving parts and user-facing complexity (queue position, hold expiry).",
    },
  ],
  relatedTopics: ["database-locking", "database-transactions", "idempotency", "payment-system"],
};
