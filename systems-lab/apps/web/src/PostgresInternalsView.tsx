import { useState } from "react";
import { POSTGRES_TOPICS } from "./postgresTopics";

export function PostgresInternalsView() {
  const [open, setOpen] = useState<string>("architecture");

  return (
    <div>
      <div className="card">
        <h3>POSTGRESQL INTERNALS · REFERENCE</h3>
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.9rem" }}>
          Eight core chapters covering how Postgres actually works. Markdown lives in{" "}
          <code>systems-lab/docs/16–24</code>. Measurements from a live cluster (your{" "}
          <code>psql</code> or <code>SYSLAB_PG_DSN</code>) are REAL; diagrams here are educational.
        </p>
        <p className="mono" style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
          Start: docs/16-postgresql-internals-index.md
        </p>
      </div>

      <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {POSTGRES_TOPICS.map((t) => {
          const isOpen = open === t.id;
          return (
            <div key={t.id} className="card" style={{ padding: isOpen ? "1rem" : "0.65rem 1rem" }}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? "" : t.id)}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  display: "flex",
                  width: "100%",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <strong>{t.title}</strong>
                <span className="mono" style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                  {isOpen ? "−" : "+"} docs/{t.doc}
                </span>
              </button>
              {isOpen && (
                <div style={{ marginTop: "0.75rem" }}>
                  <p style={{ margin: "0 0 0.5rem" }}>{t.summary}</p>
                  <ul style={{ margin: "0 0 0.75rem", paddingLeft: "1.2rem", fontSize: "0.88rem" }}>
                    {t.bullets.map((b) => (
                      <li key={b} style={{ marginBottom: "0.35rem" }}>
                        {b}
                      </li>
                    ))}
                  </ul>
                  {t.commands && t.commands.length > 0 && (
                    <>
                      <h4 style={{ margin: "0 0 0.35rem", fontSize: "0.8rem" }}>Inspect (REAL on live server)</h4>
                      {t.commands.map((c) => (
                        <pre key={c} className="mono" style={{ margin: "0.25rem 0", fontSize: "0.72rem" }}>
                          {c}
                        </pre>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>TOPIC CHECKLIST</h3>
        <table className="tools-table">
          <thead>
            <tr>
              <th>Area</th>
              <th>You should know</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Processes", "postmaster, backend, bgwriter, checkpointer, autovacuum"],
              ["Memory", "shared_buffers, work_mem, effective_cache_size"],
              ["Storage", "pages, line pointers, heap vs index files"],
              ["MVCC", "xmin/xmax, snapshots, dead tuples"],
              ["WAL", "LSN, checkpoint, recovery, replication"],
              ["Vacuum", "autovacuum, freeze, bloat, analyze"],
              ["Planner", "stats, costs, EXPLAIN ANALYZE, join types"],
              ["Indexes", "B-tree, GIN, partial, covering"],
              ["Locks", "row vs table, deadlocks, isolation levels"],
              ["Replication", "streaming, slots, logical, failover"],
              ["Ops", "pooling, max_connections, timeouts"],
            ].map(([a, b]) => (
              <tr key={a}>
                <td>{a}</td>
                <td style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
