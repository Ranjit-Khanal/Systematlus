# PostgreSQL Architecture & Processes

## Big picture

PostgreSQL is a **multi-process** server, not multi-threaded. One **postmaster** supervises worker processes and listens on the port (default 5432).

```
Client
  → postmaster (accepts connection)
    → backend process (one per connection, runs your SQL)
    → background workers (shared maintenance)
```

## Main processes

| Process | Role |
|---|---|
| **postmaster** | Listens on port, forks backends, manages shutdown, never runs user SQL |
| **backend** | One per client session; parse → plan → execute queries |
| **checkpointer** | Writes checkpoint records; advances redo horizon |
| **background writer (bgwriter)** | Proactively dirties shared buffers to smooth I/O |
| **WAL writer** | Flushes WAL buffers to `pg_wal/` |
| **autovacuum launcher** | Schedules autovacuum workers per database |
| **autovacuum worker** | Runs VACUUM/ANALYZE on tables |
| **stats collector** | Activity & IO statistics (`pg_stat_*`) |
| **logical replication worker** | Applies logical changes (when configured) |
| **WAL sender / receiver** | Streaming replication (primary / standby) |

## Shared memory (every backend sees this)

| Area | Purpose |
|---|---|
| **shared_buffers** | Page cache for table/index pages (analogous to OS cache, but Postgres-managed) |
| **WAL buffers** | In-memory WAL before flush to disk |
| **Lock manager** | Heavyweight locks, predicate locks (SSI) |
| **Proc array** | Active transactions → snapshot construction for MVCC |
| **Clog (pg_xact)** | Transaction commit status bitmap |

Rule of thumb: data pages flow **disk ↔ shared_buffers ↔ backend private memory** during queries.

## Memory per backend (private)

| Setting | Typical use |
|---|---|
| `work_mem` | Sorts, hashes, bitmap index scans — **per operation**, can multiply with parallelism |
| `maintenance_work_mem` | CREATE INDEX, VACUUM, ALTER TABLE |
| `temp_buffers` | Temporary tables |

High `work_mem` × many concurrent queries × parallel workers = RAM spikes.

## Startup & shutdown

1. **Startup**: replay WAL from last checkpoint → database consistent.
2. **Smart shutdown**: checkpoint, disconnect clients gracefully.
3. **Immediate / crash**: recovery on next start from WAL.

## Files on disk (cluster layout)

```
$PGDATA/
  base/           # database files (OID directories)
  global/         # cluster-wide catalogs
  pg_wal/         # WAL segments
  pg_xact/        # commit status (clog)
  pg_multixact/   # multixact status
  pg_stat/        # permanent stats files
```

## Why this matters

- **One backend per connection** → `max_connections` is a hard scalability knob; use pooling (see ch. 24).
- **Background workers** explain “mysterious” I/O at idle (autovacuum, checkpoint).
- **shared_buffers** vs OS page cache: both cache pages; tuning balances double caching vs Postgres explicit control.

## Inspect on a live server (REAL)

```sql
SELECT pid, backend_type, state, query
FROM pg_stat_activity
WHERE backend_type != 'client backend' OR pid = pg_backend_pid();
```
