# PostgreSQL Internals — Index

Deep reference for how PostgreSQL actually works under the hood. These docs are **conceptual + operational** — they explain real engine behavior. Only measurements from a live Postgres instance in this lab are labeled REAL (see optional Postgres experiment / your own `psql`).

## How to use this series

Read in order once, then jump by symptom:

| Symptom | Start here |
|---|---|
| Slow queries | [21-indexes-planner](./21-postgresql-indexes-planner.md) |
| Disk growth / bloat | [20-vacuum](./20-postgresql-vacuum-autovacuum.md) |
| Replication lag | [23-replication-ha](./23-postgresql-replication-ha.md) |
| Lock waits / deadlocks | [22-locking-isolation](./22-postgresql-locking-isolation.md) |
| Crash / recovery questions | [19-wal](./19-postgresql-wal-checkpoints.md) |
| “Why is my row invisible?” | [18-storage-mvcc](./18-postgresql-storage-mvcc.md) |

## Topic map

```
┌─────────────────────────────────────────────────────────────┐
│  Client (libpq) → postmaster → backend process per session  │
└───────────────────────────┬─────────────────────────────────┘
                            │
     ┌──────────────────────┼──────────────────────┐
     ▼                      ▼                      ▼
 Query pipeline        Shared memory           Background workers
 (parse/plan/exec)     (buffers, locks, WAL)   (checkpointer, autovacuum…)
     │                      │                      │
     └──────────► Storage + MVCC ◄── WAL ◄────────┘
                  (pages, tuples, indexes)
```

## Chapters

| # | Topic | Covers |
|---|---|---|
| 17 | [Architecture & processes](./17-postgresql-architecture-processes.md) | postmaster, backends, bg workers, shared memory |
| 18 | [Storage, pages & MVCC](./18-postgresql-storage-pages-mvcc.md) | heap files, tuples, xmin/xmax, visibility, HOT |
| 19 | [WAL & checkpoints](./19-postgresql-wal-checkpoints.md) | durability, LSN, recovery, full_page_writes |
| 20 | [VACUUM & bloat](./20-postgresql-vacuum-autovacuum.md) | dead tuples, autovacuum, freeze, ANALYZE |
| 21 | [Indexes & planner](./21-postgresql-indexes-planner.md) | B-tree/GIN/GiST, stats, EXPLAIN, joins |
| 22 | [Locking & isolation](./22-postgresql-locking-isolation.md) | row/table locks, deadlocks, SSI |
| 23 | [Replication & HA](./23-postgresql-replication-ha.md) | streaming, slots, logical replication |
| 24 | [Connections & pooling](./24-postgresql-connection-protocol-pooling.md) | wire protocol, limits, PgBouncer |

## Lab vs production

| In systems-lab today | Postgres internals docs |
|---|---|
| SQLite experiment (REAL timings) | Engine reference for Postgres |
| TCP/`ss` during HTTP+DB | Same stack; Postgres adds **network socket + server processes** |
| Optional `SYSLAB_PG_DSN` experiment | REAL `pg_stat_*` when DSN works |

## Essential commands (on a running cluster)

```sql
-- Version & settings
SELECT version();
SHOW shared_buffers;

-- What is running now
SELECT pid, state, wait_event_type, wait_event, query
FROM pg_stat_activity WHERE datname = current_database();

-- Table + index size
SELECT relname, pg_size_pretty(pg_total_relation_size(oid))
FROM pg_class WHERE relkind = 'r' ORDER BY pg_total_relation_size(oid) DESC LIMIT 10;

-- Plan a query
EXPLAIN (ANALYZE, BUFFERS) SELECT …;

-- Bloat signal (approx)
SELECT schemaname, relname, n_live_tup, n_dead_tup, last_autovacuum
FROM pg_stat_user_tables ORDER BY n_dead_tup DESC;
```
