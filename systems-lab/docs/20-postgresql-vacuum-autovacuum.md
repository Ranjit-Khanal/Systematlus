# VACUUM, Autovacuum & Bloat

## Dead tuples

UPDATE/DELETE leave **dead row versions**. They still occupy pages until reclaimed.

**VACUUM** (routine):

- Marks space reusable within pages
- Makes dead tuples invisible permanently
- Updates FSM & visibility map
- **Does not** return disk to OS (usually)

**VACUUM FULL**:

- Rewrites table → exclusive lock, reclaims disk to OS
- Downtime / heavy I/O — use as last resort

## FREEZE

VACUUM **freezes** old xmin so XID age stays safe → prevents wraparound emergency.

Watch:

```sql
SELECT datname, age(datfrozenxid) FROM pg_database ORDER BY 2 DESC;
```

## Autovacuum

Launcher forks workers when tables exceed thresholds:

- `autovacuum_vacuum_threshold` + scale × reltuples
- `autovacuum_analyze_threshold` for stats

Cost-based delay (`vacuum_cost_delay`) throttles vacuum I/O under load.

## ANALYZE

Updates **planner statistics** (row counts, histograms) — separate from space reclaim but often run together by autovacuum.

Without ANALYZE → bad plans (seq scans on huge tables).

## Bloat symptoms

- Table much larger than logical data
- `n_dead_tup` high in `pg_stat_user_tables`
- Queries slow despite indexes (heap pages scanned)

## Anti-patterns

| Pattern | Effect |
|---|---|
| Long open transaction | Blocks vacuum horizon |
| Disabling autovacuum globally | Guaranteed bloat |
| Mass DELETE without vacuum window | Dead tuple spike |

## Maintenance playbook

1. Check `pg_stat_user_tables` dead/live ratio.
2. Ensure autovacuum running (`log_autovacuum_min_duration`).
3. `VACUUM (ANALYZE)` on hot tables if needed.
4. `REINDEX` if index bloat suspected.

## Why this matters

Postgres MVCC **requires** vacuum as part of normal operation — not optional housekeeping.

## Inspect (REAL)

```sql
SELECT schemaname, relname, n_live_tup, n_dead_tup,
       last_vacuum, last_autovacuum, last_analyze, last_autoanalyze
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC LIMIT 20;
```
