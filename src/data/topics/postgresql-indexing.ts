import type { Topic } from "@/types/topic";

export const postgresqlIndexing: Topic = {
  id: "postgresql-indexing",
  title: "PostgreSQL Indexing",
  category: "databases",
  difficulty: "intermediate",
  isDeepDive: true,
  description:
    "An index lets PostgreSQL find rows without scanning the entire table — the same reason a book's index beats reading every page to find a topic.",
  concepts: ["Index", "B-Tree", "Sequential Scan", "Query Planner", "Composite Index", "EXPLAIN ANALYZE"],
  howItWorks: [
    "Without an index, PostgreSQL checks every row in a table to find matches — a sequential scan. This is fine for small tables, expensive for large ones.",
    "An index (usually a B-tree) stores column values in sorted order alongside a pointer to each row, so lookups become O(log n) instead of O(n).",
    "The query planner decides whether to use an index at all — for tiny tables or queries returning most rows, a sequential scan can actually be faster.",
    "Indexes speed up reads but slow down writes slightly, since every INSERT/UPDATE must also update the index.",
  ],
  architecture: [
    { id: "client", label: "Client", role: "client", x: 40, y: 200 },
    { id: "api", label: "API Server", role: "service", x: 300, y: 200 },
    { id: "planner", label: "Query Planner", role: "service", x: 560, y: 120, summary: "Decides scan vs index lookup.",
      detail: {
        role: "Query optimizer",
        why: "Chooses the cheapest execution plan based on table statistics — row counts, value distribution, existing indexes.",
        input: "Parsed SQL query",
        output: "Execution plan (seq scan, index scan, etc.)",
        operations: ["Estimate cost", "Choose plan", "Execute"],
        related: ["database-transactions"],
      },
    },
    { id: "index", label: "email_idx (B-Tree)", role: "storage", x: 560, y: 240, summary: "Sorted structure mapping email → row location." },
    { id: "table", label: "users table", role: "database", x: 820, y: 180, summary: "Heap storage of actual row data." },
  ],
  edges: [
    { id: "e1", source: "client", target: "api", kind: "sync" },
    { id: "e2", source: "api", target: "planner", kind: "sync", label: "SELECT ... WHERE email = ?" },
    { id: "e3", source: "planner", target: "index", kind: "sync", label: "index scan" },
    { id: "e4", source: "index", target: "table", kind: "sync", label: "fetch row by pointer" },
  ],
  requestFlow: [
    { id: "s1", nodeId: "api", title: "Query issued", description: "The application asks for a user by email.", operation: "SELECT * FROM users WHERE email = 'a@b.com'" },
    { id: "s2", nodeId: "planner", title: "Planner checks for a usable index", description: "It finds email_idx exists on users.email and estimates an index scan is cheaper than scanning the whole table.", latencyMs: 1 },
    { id: "s3", nodeId: "index", title: "B-tree lookup", description: "The planner walks the B-tree in O(log n) comparisons to find the matching entry and its row pointer (ctid).", latencyMs: 1 },
    { id: "s4", nodeId: "table", title: "Row fetched from the heap", description: "PostgreSQL follows the pointer to read the actual row data from the table's heap storage.", outcome: "1 row returned", latencyMs: 1 },
  ],
  implementations: [
    {
      id: "create-index",
      filename: "002_add_email_index.sql",
      language: "sql",
      description: "Adding an index concurrently avoids locking the table for writes while it builds.",
      relatedNodes: ["index", "table"],
      code: `CREATE INDEX CONCURRENTLY email_idx
ON users (email);

-- Composite index: supports queries filtering on
-- (org_id) alone AND (org_id, status) together,
-- but NOT (status) alone.
CREATE INDEX org_status_idx
ON users (org_id, status);`,
    },
    {
      id: "explain",
      filename: "explain.sql",
      language: "sql",
      description: "EXPLAIN ANALYZE shows whether the planner actually used the index.",
      relatedNodes: ["planner"],
      code: `EXPLAIN ANALYZE
SELECT * FROM users WHERE email = 'a@b.com';

-- Before index:
-- Seq Scan on users (cost=0.00..18334.00 rows=1)
--   Filter: (email = 'a@b.com'::text)
--   Rows Removed by Filter: 999999

-- After index:
-- Index Scan using email_idx on users
--   (cost=0.42..8.44 rows=1)
--   Index Cond: (email = 'a@b.com'::text)`,
    },
  ],
  database: {
    tables: [
      {
        name: "users",
        columns: [
          { name: "id", type: "bigint", isPrimaryKey: true },
          { name: "email", type: "text", isIndexed: true, note: "unique, indexed via email_idx" },
          { name: "org_id", type: "bigint", isForeignKey: true, isIndexed: true },
          { name: "status", type: "text" },
          { name: "created_at", type: "timestamptz" },
        ],
        exampleRows: [
          { id: 1, email: "a@b.com", org_id: 10, status: "active" },
          { id: 2, email: "c@d.com", org_id: 10, status: "invited" },
        ],
        indexNote: {
          before: "SELECT * FROM users WHERE email = ?\n→ sequential scan over every row",
          after: "email_idx (B-Tree)\n→ direct O(log n) lookup",
          explanation:
            "On a table with a million rows, a sequential scan reads all million. With an index, the same lookup touches roughly log₂(1,000,000) ≈ 20 pages.",
        },
      },
    ],
  },
  tradeoffs: {
    advantages: [
      "Dramatically faster reads on large tables (O(log n) vs O(n))",
      "Enables efficient sorting and range queries (ORDER BY, BETWEEN)",
      "Unique indexes double as a constraint enforcement mechanism",
    ],
    disadvantages: [
      "Every write (INSERT/UPDATE/DELETE) must also update each index on that table",
      "Indexes consume disk space, sometimes more than the table itself",
      "Too many indexes on a write-heavy table can meaningfully hurt write throughput",
    ],
    whenToUse:
      "Index columns used in WHERE, JOIN, and ORDER BY clauses on tables with more than a few thousand rows. Don't index columns that are rarely queried or have very low cardinality (like a boolean) unless combined with other columns.",
  },
  failureModes: [
    {
      id: "missing-index",
      title: "Query without an index",
      scenario: "A table grows from 10k to 10M rows and a WHERE clause has no supporting index.",
      path: ["api", "table"],
      explanation: "Every query becomes a full sequential scan, reading every row. As the table grows, query time grows linearly with it.",
      consequences: ["Query latency climbs from milliseconds to seconds", "Increased CPU and I/O load on the database, slowing down unrelated queries too"],
    },
    {
      id: "unused-index-bloat",
      title: "Too many unused indexes",
      scenario: "A table accumulates indexes added defensively over time, many never used by the planner.",
      path: ["table"],
      explanation: "Each index must be updated on every write, and the planner has more (often irrelevant) options to evaluate.",
      consequences: ["Slower writes", "Wasted disk space", "Should be periodically audited with pg_stat_user_indexes"],
    },
  ],
  scaling: [
    {
      id: "stage1",
      title: "No indexes",
      description: "A small table where sequential scans are fast enough.",
      nodes: ["API", "users table (seq scan)"],
      problem: "Fine at low row counts.",
    },
    {
      id: "stage2",
      title: "Add targeted indexes",
      description: "Index the columns actually used in WHERE/JOIN/ORDER BY.",
      nodes: ["API", "Query Planner", "email_idx", "users table"],
      problem: "Table has grown; specific lookups are now slow.",
      solution: "Add B-tree indexes on high-selectivity, frequently filtered columns.",
      tradeoff: "Slightly slower writes; more disk usage.",
    },
    {
      id: "stage3",
      title: "Partial and covering indexes",
      description: "For very large tables, use partial indexes (WHERE status = 'active') or covering indexes (INCLUDE) to shrink index size and avoid heap fetches.",
      nodes: ["API", "Partial index", "users table"],
      problem: "Even indexes get large and heap fetches (visiting the table after the index) add latency.",
      solution: "Narrow the index to the subset of rows actually queried, or include extra columns so the index alone satisfies the query.",
      tradeoff: "More indexes to design and maintain deliberately, rather than indexing everything.",
    },
  ],
  relatedTopics: ["database-transactions", "database-sharding", "read-replicas", "postgresql"],
};
