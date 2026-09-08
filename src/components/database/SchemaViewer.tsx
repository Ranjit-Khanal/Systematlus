import * as React from "react";
import { Key, Link2, Zap, ArrowRight } from "lucide-react";
import type { DatabaseSchema, DatabaseTable } from "@/types/topic";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

interface SchemaViewerProps {
  schema: DatabaseSchema;
}

export function SchemaViewer({ schema }: SchemaViewerProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {schema.tables.map((table) => (
        <TableCard key={table.name} table={table} />
      ))}
    </div>
  );
}

function TableCard({ table }: { table: DatabaseTable }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between bg-muted/50 px-3 py-2 text-left"
      >
        <span className="font-mono text-sm font-semibold text-foreground">{table.name}</span>
        <span className="text-xs text-muted-foreground">{expanded ? "hide details" : "show details"}</span>
      </button>

      <div className="divide-y divide-border">
        {table.columns.map((col) => (
          <div key={col.name} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
            <div className="flex items-center gap-1.5 font-mono">
              {col.name}
              {col.isPrimaryKey && <Key size={11} className="text-warning" />}
              {col.isForeignKey && <Link2 size={11} className="text-accent" />}
              {col.isIndexed && <Zap size={11} className="text-success" />}
            </div>
            <span className="text-xs text-muted-foreground">{col.type}</span>
          </div>
        ))}
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-border bg-card p-3">
          <div className="flex flex-wrap gap-2">
            {table.columns.some((c) => c.isPrimaryKey) && <Badge variant="warning">Primary Key</Badge>}
            {table.columns.some((c) => c.isForeignKey) && <Badge variant="accent">Foreign Keys</Badge>}
            {table.columns.some((c) => c.isIndexed) && <Badge variant="success">Indexes</Badge>}
          </div>

          {table.columns.some((c) => c.note) && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {table.columns
                .filter((c) => c.note)
                .map((c) => (
                  <li key={c.name}>
                    <span className="font-mono text-foreground">{c.name}</span> — {c.note}
                  </li>
                ))}
            </ul>
          )}

          {table.exampleRows && table.exampleRows.length > 0 && (
            <div className="overflow-x-auto">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Example rows
              </div>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    {Object.keys(table.exampleRows[0]).map((k) => (
                      <th key={k} className="border-b border-border px-2 py-1 text-left font-mono text-muted-foreground">
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.exampleRows.map((row, i) => (
                    <tr key={i}>
                      {Object.values(row).map((v, j) => (
                        <td key={j} className="border-b border-border px-2 py-1 font-mono">
                          {String(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {table.indexNote && (
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Why indexing matters
              </div>
              <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
                <pre className={cn("whitespace-pre-wrap rounded bg-code-bg px-2 py-2 text-[11px]")}>
                  {table.indexNote.before}
                </pre>
                <ArrowRight size={14} className="mx-auto hidden text-muted-foreground sm:block" />
                <pre className="whitespace-pre-wrap rounded bg-code-bg px-2 py-2 text-[11px]">
                  {table.indexNote.after}
                </pre>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{table.indexNote.explanation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
