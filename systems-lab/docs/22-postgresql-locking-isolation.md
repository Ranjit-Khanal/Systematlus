# Locking & Isolation Levels

## Two lock layers

1. **MVCC** — snapshot visibility for reads (no row lock for plain SELECT).
2. **Explicit locks** — when conflicts must be serialized.

## Row-level locks

| Statement | Lock |
|---|---|
| `SELECT … FOR UPDATE` | Row exclusive — blocks other FOR UPDATE/DELETE |
| `SELECT … FOR SHARE` | Row shared |
| `UPDATE/DELETE` | Row exclusive on affected rows |
| `INSERT` | No wait on row (conflicts via unique index / exclusion) |

`NOWAIT` / `SKIP LOCKED` change blocking behavior (queues, job workers).

## Table-level locks (lock modes)

Lightweight for DDL and some scans — see `pg_locks` `mode` column:

- `AccessShare` — SELECT
- `RowExclusive` — INSERT/UPDATE/DELETE
- `AccessExclusive` — ALTER TABLE, DROP (blocks everything)

## Deadlocks

Cycle: Tx A waits B, B waits A → **deadlock detector** aborts one transaction.

Fix: consistent lock ordering, shorter transactions, indexes to speed lock acquisition.

## Isolation levels (SQL standard)

| Level | Behavior in Postgres |
|---|---|
| **Read Uncommitted** | Treated as Read Committed (no dirty reads) |
| **Read Committed** (default) | New snapshot **each statement** |
| **Repeatable Read** | Snapshot for whole transaction; phantoms blocked for known rows |
| **Serializable** | **SSI** — predicate locks detect dangerous structures |

## Serializable Snapshot Isolation (SSI)

Tracks dependencies between rw-conflicts; may abort with:

```
ERROR: could not serialize access due to concurrent update
```

Application must **retry** serializable transactions.

## Predicate / advisory locks

- **Advisory locks** — app-level mutex (`pg_advisory_lock`).
- Used for migrations, job coordination.

## Monitoring locks (REAL)

```sql
SELECT blocked.pid AS blocked_pid,
       blocked.query AS blocked_query,
       blocking.pid AS blocking_pid,
       blocking.query AS blocking_query
FROM pg_stat_activity blocked
JOIN pg_locks bl ON bl.pid = blocked.pid AND NOT bl.granted
JOIN pg_locks kl ON kl.locktype = bl.locktype
  AND kl.database IS NOT DISTINCT FROM bl.database
  AND kl.relation IS NOT DISTINCT FROM bl.relation
  AND kl.page IS NOT DISTINCT FROM bl.page
  AND kl.tuple IS NOT DISTINCT FROM bl.tuple
  AND kl.virtualxid IS NOT DISTINCT FROM bl.virtualxid
  AND kl.transactionid IS NOT DISTINCT FROM bl.transactionid
  AND kl.classid IS NOT DISTINCT FROM bl.classid
  AND kl.objid IS NOT DISTINCT FROM bl.objid
  AND kl.objsubid IS NOT DISTINCT FROM bl.objsubid
  AND kl.pid != bl.pid
JOIN pg_stat_activity blocking ON blocking.pid = kl.pid AND kl.granted;

SELECT mode, locktype, relation::regclass, granted, pid
FROM pg_locks WHERE pid = pg_backend_pid();
```

## Why this matters

- **Read Committed** ≠ “no surprises” — same query twice in one tx can return different rows.
- Hot row updates (`UPDATE counters`) → row lock contention → use batching or advisory patterns.
- DDL in production needs lock timeout strategy.
