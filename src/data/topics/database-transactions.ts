import type { Topic } from "@/types/topic";

export const databaseTransactions: Topic = {
  id: "database-transactions",
  title: "Database Transactions",
  category: "databases",
  difficulty: "intermediate",
  isDeepDive: true,
  description:
    "A transaction groups multiple operations so they either all succeed together or all fail together — there's no in-between state.",
  concepts: ["ACID", "Atomicity", "Isolation Levels", "Commit", "Rollback", "Deadlock"],
  howItWorks: [
    "You start a transaction with BEGIN. Every statement after that is provisional — nothing is visible to other connections yet.",
    "If every statement succeeds, COMMIT makes all the changes permanent and visible at once.",
    "If anything fails, ROLLBACK undoes everything since BEGIN, as if none of it happened.",
    "Isolation levels control how much one transaction can see of another transaction's uncommitted or concurrent changes — trading consistency for concurrency.",
  ],
  architecture: [
    { id: "client", label: "Client", role: "client", x: 40, y: 200 },
    { id: "api", label: "API Server", role: "service", x: 300, y: 200, summary: "Wraps related writes in a transaction." },
    { id: "db", label: "PostgreSQL", role: "database", x: 580, y: 200, summary: "Enforces ACID guarantees.",
      detail: {
        role: "Transactional store",
        why: "Guarantees that multi-step operations (e.g. debit one account, credit another) never leave data half-written.",
        input: "BEGIN ... COMMIT/ROLLBACK block",
        output: "All-or-nothing state change",
        operations: ["BEGIN", "COMMIT", "ROLLBACK", "SAVEPOINT"],
        failure: "A crash mid-transaction is treated as an implicit rollback — partial writes are never visible.",
        related: ["database-locking", "postgresql"],
      },
    },
  ],
  edges: [
    { id: "e1", source: "client", target: "api", kind: "sync" },
    { id: "e2", source: "api", target: "db", kind: "sync", label: "BEGIN ... COMMIT" },
  ],
  requestFlow: [
    { id: "s1", nodeId: "api", title: "Transfer requested", description: "A client asks to transfer $50 from Account A to Account B.", operation: "POST /transfers" },
    { id: "s2", nodeId: "db", title: "BEGIN", description: "The API opens a transaction. Nothing written from here is visible to anyone else yet.", operation: "BEGIN" },
    { id: "s3", nodeId: "db", title: "Debit account A", description: "Subtract $50 from Account A's balance.", operation: "UPDATE accounts SET balance = balance - 50 WHERE id = 'A'" },
    { id: "s4", nodeId: "db", title: "Credit account B", description: "Add $50 to Account B's balance. If this fails, the debit above must be undone too.", operation: "UPDATE accounts SET balance = balance + 50 WHERE id = 'B'" },
    { id: "s5", nodeId: "db", title: "COMMIT", description: "Both updates become permanent and visible together, atomically.", operation: "COMMIT", outcome: "success" },
  ],
  implementations: [
    {
      id: "transfer-tx",
      filename: "transfer.service.ts",
      language: "TypeScript",
      description: "A money transfer wrapped in a transaction — if the credit fails, the debit is rolled back automatically.",
      relatedNodes: ["api", "db"],
      code: `await db.transaction(async (tx) => {
  await tx.query(
    "UPDATE accounts SET balance = balance - $1 WHERE id = $2",
    [amount, fromAccountId],
  );

  await tx.query(
    "UPDATE accounts SET balance = balance + $1 WHERE id = $2",
    [amount, toAccountId],
  );

  // If either query throws, the transaction library
  // automatically issues ROLLBACK instead of COMMIT.
});`,
    },
    {
      id: "raw-sql-tx",
      filename: "transfer.sql",
      language: "sql",
      description: "The same transaction expressed in raw SQL.",
      relatedNodes: ["db"],
      code: `BEGIN;

UPDATE accounts SET balance = balance - 50 WHERE id = 'A';
UPDATE accounts SET balance = balance + 50 WHERE id = 'B';

COMMIT;
-- if any statement fails: ROLLBACK;`,
    },
  ],
  tradeoffs: {
    advantages: [
      "Guarantees related writes succeed or fail as a unit — no half-applied updates",
      "Isolation prevents concurrent transactions from seeing each other's partial work",
      "Rollback gives you a clean recovery path when something goes wrong mid-operation",
    ],
    disadvantages: [
      "Holding a transaction open for too long increases lock contention",
      "Higher isolation levels (SERIALIZABLE) reduce concurrency and can cause more retries",
      "Distributed transactions across multiple databases/services are far harder (see Distributed Transactions)",
    ],
    whenToUse:
      "Wrap any set of writes that must be consistent with each other — financial transfers, inventory decrements paired with order creation, or any 'update two things together' operation. Keep transactions short-lived.",
  },
  failureModes: [
    {
      id: "deadlock",
      title: "Deadlock between two transactions",
      scenario: "Transaction 1 locks Account A then waits for Account B. Transaction 2 locks Account B then waits for Account A.",
      path: ["db"],
      explanation: "Neither transaction can proceed — each holds a lock the other needs. PostgreSQL detects the cycle and aborts one transaction with a deadlock error.",
      consequences: ["One transaction is rolled back automatically and must be retried by the application", "Consistent lock ordering (always lock lower ID first) prevents this"],
    },
    {
      id: "long-tx",
      title: "A transaction stays open too long",
      scenario: "An API bug leaves a transaction open while waiting on a slow external API call.",
      path: ["api", "db"],
      explanation: "The open transaction holds row locks and prevents autovacuum from cleaning up dead tuples, which can bloat the database over time.",
      consequences: ["Other transactions queue up waiting for locks", "Table bloat and degraded performance database-wide"],
    },
  ],
  scaling: [
    {
      id: "stage1",
      title: "Single unguarded writes",
      description: "Each update is its own statement, with no grouping.",
      nodes: ["API", "PostgreSQL"],
      problem: "A failure between two related writes leaves data inconsistent (money leaves A but never reaches B).",
    },
    {
      id: "stage2",
      title: "Wrap related writes in transactions",
      description: "Group dependent writes with BEGIN/COMMIT.",
      nodes: ["API", "BEGIN...COMMIT", "PostgreSQL"],
      solution: "All-or-nothing semantics for multi-step writes.",
      tradeoff: "Long-running transactions increase lock contention.",
    },
    {
      id: "stage3",
      title: "Distributed transactions",
      description: "When writes span multiple services or databases, a single BEGIN/COMMIT no longer applies.",
      nodes: ["Service A DB", "Saga / 2PC coordinator", "Service B DB"],
      problem: "No single database can lock across service boundaries.",
      solution: "Use patterns like Sagas (compensating actions) or two-phase commit.",
      tradeoff: "Much higher complexity; often eventual rather than immediate consistency.",
    },
  ],
  relatedTopics: ["database-locking", "distributed-transactions", "postgresql", "consistency"],
};
