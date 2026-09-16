# Database

## Concept

Most HTTP APIs read or write persistent data. The handler calls `database/sql`, the driver talks to the engine, and the engine uses the filesystem (VFS) to read/write database files.

## Mental model

```
GET /api/users
  → HTTP handler
    → db.Query("SELECT …")
      → SQLite driver
        → read .sqlite file (VFS)
          → rows → JSON response
```

## Real in this lab

| Item | Source |
|---|---|
| CREATE TABLE / INSERT timing | Measured in experiment |
| SELECT duration + row count | Measured around `db.Query` |
| Connection pool stats | `db.Stats()` from `database/sql` |
| SQLite file path + size | Temp file + `os.Stat` |
| HTTP status + total latency | Same as HTTP experiment |

Stack diagrams in the UI are SIMULATION cues.

## Engine

This phase uses **SQLite** (pure Go driver, no Docker). For **PostgreSQL internals** (MVCC, WAL, vacuum, planner, replication, etc.) see [16-postgresql-internals-index.md](./16-postgresql-internals-index.md) and the **POSTGRES INTERNALS** nav panel.

## Experiment

Lab → DATABASE → **RUN — HTTP + SQLite SELECT**.

## Why it matters

Slow endpoints are often “the query”, not “the framework”. Seeing handler time vs `db_ms` vs total HTTP time is the first step toward indexing, pooling, and query tuning.
