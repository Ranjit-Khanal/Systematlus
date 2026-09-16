# Indexes & Query Planner

## Query pipeline

```
SQL string
  → Parser (parse tree)
  → Analyzer (names, types)
  → Rewriter (rules, views, RLS)
  → Planner/Optimizer (plan tree + costs)
  → Executor (runs plan nodes)
```

## Statistics

Planner uses **pg_statistic** (from ANALYZE):

- Row count estimates
- Null fraction
- Most common values
- Histograms for range queries
- Correlation (physical order vs logical)

Stale stats → wrong row estimates → wrong join order → disasters.

## Cost model (simplified)

Each plan node has estimated **startup_cost** + **total_cost** (abstract units):

| GUC | Meaning |
|---|---|
| `seq_page_cost` | Sequential page read |
| `random_page_cost` | Random page read (often >> seq on HDD) |
| `cpu_tuple_cost` | Per-row CPU |
| `cpu_index_tuple_cost` | Index entry processing |
| `effective_cache_size` | Hint: how much cache planner assumes |

Compare **Seq Scan** vs **Index Scan** vs **Bitmap Index Scan** costs.

## Index access methods

| Type | Best for |
|---|---|
| **B-tree** (default) | Equality, ranges, sorting, UNIQUE |
| **Hash** | Equality only (limited use) |
| **GiST** | Geometry, full-text, ranges, nearest-neighbor |
| **GIN** | Arrays, jsonb `@>`, full-text inverted |
| **BRIN** | Very large naturally ordered tables (time series) |
| **SP-GiST** | Non-balanced partitions (quadtrees, etc.) |

## B-tree internals (conceptual)

Root → internal pages → leaf pages → **heap ctid** pointers.

**Index-only scan**: if visibility map says page all-visible, fetch from index alone.

## Plan node types you will see in EXPLAIN

| Node | When |
|---|---|
| Seq Scan | Full table read (small table or no useful index) |
| Index Scan | Index lookup + heap fetch |
| Bitmap Index Scan + Bitmap Heap Scan | Many matching rows — batch heap visits |
| Nested Loop | Small outer × index on inner |
| Hash Join | Build hash on one side, probe other |
| Merge Join | Both sides sorted on join key |
| Sort / HashAggregate | ORDER BY, GROUP BY, DISTINCT |
| Gather | Parallel workers |

## EXPLAIN essentials

```sql
EXPLAIN SELECT …;                          -- plan only
EXPLAIN (ANALYZE, BUFFERS) SELECT …;       -- REAL timings + buffer hits/reads
```

Read for:

- **Actual rows** vs **rows estimate** (large gap = stats problem)
- **Buffers: shared hit/read** — cache effectiveness
- **Loops** on nested nodes

## Index design rules of thumb

1. Index columns in **WHERE**, **JOIN**, **ORDER BY** (leftmost prefix for multicolumn).
2. **Partial index** when queries always filter subset (`WHERE active`).
3. **Covering index** (`INCLUDE`) to enable index-only scans.
4. Avoid indexing low-cardinality alone unless partial.
5. Too many indexes slow writes (each INSERT/UPDATE touches indexes).

## Why this matters

Most “Postgres is slow” tickets are **planner + index + stats**, not magic server slowness.

## Inspect (REAL)

```sql
SELECT indexrelname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes ORDER BY idx_scan;

SELECT * FROM pg_stat_user_tables WHERE relname = 'mytable';
```
