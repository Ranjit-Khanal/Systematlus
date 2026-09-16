# Connections, Protocol & Pooling

## libpq wire protocol

Client speaks a message-based protocol over TCP (or Unix socket):

1. Startup (user, database, params)
2. Authentication (scram-sha-256, cert, etc.)
3. Simple query or **extended query** (Parse → Bind → Execute → Sync)
4. RowDescription + DataRow messages back

Each **backend process** serves one connection → RAM overhead per session (~ few MB baseline + work_mem spikes).

## Connection limits

| Setting | Effect |
|---|---|
| `max_connections` | Hard cap on backends |
| `superuser_reserved_connections` | Headroom for admin |

Hitting the cap → `FATAL: sorry, too many clients already`.

## Prepared statements

- Server-side plan cache (`PREPARE` / parameterized queries).
- ORMs often use unnamed prepared statements in extended protocol.
- **PgBouncer transaction pooling** + prepared statements = known footgun (use session mode or disable prepare).

## Pooling options

| Layer | Examples | Notes |
|---|---|---|
| **Driver pool** | Go `database/sql`, HikariCP | Pool inside app process |
| **External pooler** | PgBouncer, pgpool-II | Multiplex many clients → fewer server connections |
| **Server-side** | Not built-in | Must use external tool |

### PgBouncer modes

| Mode | Behavior |
|---|---|
| **Session** | Client owns server connection for whole session — safest, least multiplexing |
| **Transaction** | Server conn returned after each transaction — high multiplexing |
| **Statement** | Rare; breaks some session features |

## What breaks with aggressive pooling

- `SET`, temp tables, advisory locks spanning transactions
- `LISTEN/NOTIFY` session affinity
- Large prepared statement sets

## TLS

`sslmode` (disable / require / verify-full) — terminate TLS at pooler or Postgres.

## Lab stack mapping (REAL vs SIMULATION)

When Postgres experiment runs with `SYSLAB_PG_DSN`:

```
Go database/sql pool
  → TCP to :5432                    REAL (ss)
    → postmaster accept             REAL (server)
      → backend executes query      REAL (pg_stat_activity)
        → shared_buffers / WAL      REAL engine behavior
```

Without DSN: read these docs + SQLite lab for handler timing pattern only.

## Tuning checklist

1. Count app instances × pool size — must be < `max_connections`.
2. Prefer **transaction pooling** for stateless APIs.
3. Set **statement_timeout**, **idle_in_transaction_session_timeout**.
4. Use **Unix socket** on same host to skip TCP overhead (minor).

## Inspect (REAL)

```sql
SELECT count(*), state FROM pg_stat_activity GROUP BY 2;
SHOW max_connections;
```
