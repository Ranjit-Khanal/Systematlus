# Storage, Pages & MVCC

## Physical storage hierarchy

```
Tablespace → Database → Schema → Table (relation)
  → heap file(s) + optional index files + TOAST
```

Default page size: **8 KB** (`BLCKSZ`). Everything reads/writes in pages.

## Page layout (simplified)

```
Page header
  → line pointers (array of offsets to tuples)
    → tuple 1, tuple 2, …
  → free space
```

Indexes use the same page concept with different tuple formats (B-tree posts down to heap `ctid`).

## Heap tuple header (MVCC core)

Each row version carries system columns:

| Column | Meaning |
|---|---|
| **xmin** | Inserting transaction ID |
| **xmax** | Deleting/updating transaction ID (0 if live) |
| **cid** | Command ID within transaction |
| **ctid** | Physical location (block, offset); updates create new version with new ctid |

**UPDATE = INSERT new row version + mark old dead** (not in-place overwrite for normal rows).

## MVCC visibility

A snapshot asks: *which xmin/xmax pairs are visible to me?*

- Readers **do not block writers**; writers **do not block readers** (for normal reads).
- `SELECT` uses a snapshot taken at statement or transaction start (depends on isolation level).
- Old versions remain until **VACUUM** reclaims space.

## Hint bits

Commit status cached on tuple header to avoid repeated clog lookups once known.

## HOT (Heap-Only Tuple) updates

If an UPDATE does not change indexed columns and free space exists on the **same page**, Postgres can chain row versions on that page without new index entries → cheaper updates.

## TOAST

Values too large for a page are compressed/split into a **TOAST side table** (Out-of-line storage). Transparent to SQL but affects I/O.

## Visibility map & FSM

| Structure | Purpose |
|---|---|
| **Visibility map** | Pages where all tuples visible to all (enables index-only scans) |
| **Free space map (FSM)** | Tracks page free space for inserts |

## Transaction ID wraparound

XIDs are 32-bit → **must FREEZE** old tuples via VACUUM before wraparound threatens shutdown protection mode.

## Mental model

```
INSERT → new tuple (xmin = me)
UPDATE → new tuple + old tuple xmax set
DELETE → xmax set on tuple (ghost until vacuum)
SELECT → snapshot picks visible versions
```

## Why this matters

- **Bloat** = dead tuples + unused free space not yet reclaimed.
- **Long transactions** hold xmin horizon → block vacuum → bloat grows.
- **Index bloat** separate from heap bloat; REINDEX may be needed.

## Inspect (REAL)

```sql
SELECT xmin, xmax, ctid, * FROM mytable LIMIT 5;  -- system columns with explicit select

SELECT relname, n_live_tup, n_dead_tup, n_mod_since_analyze
FROM pg_stat_user_tables WHERE relname = 'mytable';
```
