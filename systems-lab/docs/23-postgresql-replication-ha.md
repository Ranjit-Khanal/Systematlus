# Replication & High Availability

## Physical (streaming) replication

Primary streams **WAL bytes** to standby → standby replays → copy of cluster files.

```
Primary                         Standby
  WAL insert  →  walsender  →  walreceiver  →  replay
```

Modes:

| Mode | Durability tradeoff |
|---|---|
| **Asynchronous** | Primary doesn't wait; small RPO window on crash |
| **Synchronous** | Commit waits for standby flush (`synchronous_commit`, `synchronous_standby_names`) |

## Replication slots

**Physical slot** on primary:

- Primary retains WAL until standby consumes
- Prevents WAL deletion that would break catch-up
- Risk: disconnected standby → **WAL disk fill**

Monitor: `pg_replication_slots`, `pg_wal_lsn_diff`.

## Hot standby

Standby accepts **read-only** connections (`hot_standby = on`).

Queries on standby can conflict with WAL apply → `canceling statement due to conflict with recovery`.

## Logical replication

Row-change stream (INSERT/UPDATE/DELETE) via **publication / subscription**:

- Selective tables
- Cross-version upgrades
- Different schema on subscriber

Uses **replication slots** + decode plugin (`pgoutput`).

## Failover (conceptual)

1. Detect primary failure (Patroni, repmgr, cloud RDS, etc.).
2. Promote standby → new primary.
3. Rewind/rebuild old primary or replace node.
4. Update DNS / VIP / connection pooler.

Split-brain prevention requires quorum / leader election.

## Backup strategy layers

| Method | RPO / RTO sketch |
|---|---|
| Nightly pg_dump | Hours / hours |
| Base backup + WAL archive | Minutes / minutes |
| Sync replica + automatic failover | Seconds / seconds |

## Read scaling

- **Read replicas** — async physical standbys
- **Connection pooler** — route reads (see ch. 24)
- Not a substitute for **sharding** when write path saturates

## Why this matters

- Replication lag = bytes of WAL not yet applied — check `pg_stat_replication`.
- Long transactions on primary block WAL recycling → replica bloat + disk pressure.
- Logical replication ≠ DDL automatically — schema changes need care.

## Inspect (REAL)

```sql
-- On primary
SELECT application_name, client_addr, state, sync_state,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn)) AS replay_lag
FROM pg_stat_replication;

-- On standby
SELECT pg_is_in_recovery(), pg_last_wal_receive_lsn(), pg_last_wal_replay_lsn();
```
