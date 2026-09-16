# WAL & Checkpoints

## Write-Ahead Logging (WAL)

**Rule**: before modified data pages hit disk, the change is logged to WAL.

Why:

1. **Durability** — commit = WAL flushed (depending on `synchronous_commit`).
2. **Crash recovery** — replay WAL to reach consistent state.
3. **Replication** — standbys replay the same WAL stream.

## WAL records

- Each change generates WAL records with an **LSN** (Log Sequence Number).
- WAL stored in `pg_wal/` as 16 MB segments (default).
- WAL is **append-only**; old segments recycled or archived.

## Checkpoint

Periodic **checkpoint** writes:

- Dirty shared_buffers pages to data files
- Checkpoint record in WAL marking redo start point

Parameters (high level):

| Setting | Effect |
|---|---|
| `checkpoint_timeout` | Time between checkpoints |
| `max_wal_size` | WAL volume triggers checkpoint |
| `checkpoint_completion_target` | Spread dirty write I/O |
| `full_page_writes` | First page change after checkpoint writes full page image to WAL (protects against partial page writes) |

## Crash recovery flow

```
Start → find last checkpoint LSN → replay WAL forward → consistent DB
```

## synchronous_commit

| Value | Behavior |
|---|---|
| `on` (default) | Commit waits for WAL flush to disk |
| `off` | Commit returns faster; small window of lost commits on crash |

## WAL archiving & PITR

- **archive_mode** + `archive_command` → ship WAL for point-in-time recovery.
- Base backup + continuous WAL = restore to timestamp.

## Replication link

Primary **walsender** streams WAL to standby **walreceiver** → standby replays.

## Why this matters

- Write spikes during **checkpoint** → tune `checkpoint_completion_target`, storage.
- Disk full in `pg_wal` often means **replication slot** holding old WAL.
- `full_page_writes` tradeoff: safety vs WAL volume.

## Inspect (REAL)

```sql
SELECT pg_current_wal_lsn(), pg_walfile_name(pg_current_wal_lsn());

SELECT * FROM pg_stat_bgwriter;  -- checkpoints timed, buffers written

SELECT slot_name, active, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained
FROM pg_replication_slots;
```
