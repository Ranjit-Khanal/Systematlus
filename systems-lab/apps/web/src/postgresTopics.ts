export type PostgresTopic = {
  id: string;
  title: string;
  doc: string;
  summary: string;
  bullets: string[];
  commands?: string[];
};

export const POSTGRES_TOPICS: PostgresTopic[] = [
  {
    id: "architecture",
    title: "Architecture & processes",
    doc: "17-postgresql-architecture-processes.md",
    summary: "Multi-process model: postmaster, one backend per connection, background workers, shared memory.",
    bullets: [
      "postmaster accepts connections and forks backends — it never runs your SQL",
      "shared_buffers + WAL buffers + lock table live in shared memory",
      "checkpointer, bgwriter, walwriter, autovacuum, stats collector run in background",
      "max_connections × work_mem can exhaust RAM — pool externally",
    ],
    commands: [
      "SELECT pid, backend_type, state FROM pg_stat_activity;",
    ],
  },
  {
    id: "storage-mvcc",
    title: "Storage, pages & MVCC",
    doc: "18-postgresql-storage-pages-mvcc.md",
    summary: "8 KB pages, row versions with xmin/xmax, snapshots, HOT updates, TOAST.",
    bullets: [
      "UPDATE creates a new row version; old becomes dead until VACUUM",
      "Readers use snapshots — no blocking reads vs writers for normal SELECT",
      "HOT updates avoid new index entries when safe on same page",
      "XID wraparound requires FREEZE via autovacuum",
    ],
    commands: [
      "SELECT n_live_tup, n_dead_tup FROM pg_stat_user_tables WHERE relname = '…';",
    ],
  },
  {
    id: "wal",
    title: "WAL & checkpoints",
    doc: "19-postgresql-wal-checkpoints.md",
    summary: "Write-ahead log for durability, crash recovery, and replication.",
    bullets: [
      "Commit durability = WAL flushed (synchronous_commit)",
      "Checkpoints flush dirty buffers and bound recovery time",
      "full_page_writes protect against torn pages after checkpoint",
      "Replication slots retain WAL — monitor disk usage",
    ],
    commands: [
      "SELECT pg_current_wal_lsn();",
      "SELECT * FROM pg_stat_bgwriter;",
    ],
  },
  {
    id: "vacuum",
    title: "VACUUM & bloat",
    doc: "20-postgresql-vacuum-autovacuum.md",
    summary: "Dead tuple reclaim, autovacuum, ANALYZE, freeze.",
    bullets: [
      "Routine VACUUM reclaims space inside pages; VACUUM FULL rewrites table exclusively",
      "Long transactions block vacuum horizon → bloat",
      "ANALYZE feeds planner statistics — not optional on hot tables",
      "Watch datfrozenxid age cluster-wide",
    ],
    commands: [
      "SELECT relname, n_dead_tup, last_autovacuum FROM pg_stat_user_tables ORDER BY n_dead_tup DESC;",
    ],
  },
  {
    id: "indexes-planner",
    title: "Indexes & query planner",
    doc: "21-postgresql-indexes-planner.md",
    summary: "Parse → plan → execute; B-tree/GIN/GiST; EXPLAIN ANALYZE.",
    bullets: [
      "Bad stats → wrong row estimates → wrong plans",
      "B-tree default; GIN for jsonb/array; BRIN for ordered huge tables",
      "Index-only scans need visibility map + covering columns",
      "EXPLAIN (ANALYZE, BUFFERS) is the ground truth tool",
    ],
    commands: [
      "EXPLAIN (ANALYZE, BUFFERS) SELECT …;",
      "SELECT indexrelname, idx_scan FROM pg_stat_user_indexes;",
    ],
  },
  {
    id: "locking",
    title: "Locking & isolation",
    doc: "22-postgresql-locking-isolation.md",
    summary: "Row/table locks, deadlocks, Read Committed vs Serializable (SSI).",
    bullets: [
      "Default Read Committed = new snapshot per statement",
      "FOR UPDATE takes row locks; deadlocks abort one transaction",
      "Serializable uses SSI — may require app retries",
      "DDL takes AccessExclusive — plan lock timeouts in prod",
    ],
    commands: [
      "SELECT … FROM pg_stat_activity … pg_locks … (blocked query pattern)",
    ],
  },
  {
    id: "replication",
    title: "Replication & HA",
    doc: "23-postgresql-replication-ha.md",
    summary: "Physical streaming WAL, slots, logical replication, failover concepts.",
    bullets: [
      "Async replication = small data loss window on primary crash",
      "Slots prevent WAL deletion — disconnected replica can fill disk",
      "Logical replication = table-level change stream",
      "Failover needs leader election — not automatic magic",
    ],
    commands: [
      "SELECT * FROM pg_stat_replication;",
      "SELECT * FROM pg_replication_slots;",
    ],
  },
  {
    id: "connections",
    title: "Connections & pooling",
    doc: "24-postgresql-connection-protocol-pooling.md",
    summary: "libpq protocol, max_connections, PgBouncer modes.",
    bullets: [
      "One backend process per connection — pool at app or PgBouncer",
      "Transaction pooling multiplexes but breaks session features",
      "Prepared statements + transaction pooling need care",
      "Set idle_in_transaction_session_timeout",
    ],
    commands: [
      "SELECT count(*), state FROM pg_stat_activity GROUP BY 2;",
      "SHOW max_connections;",
    ],
  },
];
