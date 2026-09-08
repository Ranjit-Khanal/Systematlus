import { Check, X } from "lucide-react";
import type { Tradeoff } from "@/types/topic";

export function TradeoffsList({ tradeoffs }: { tradeoffs: Tradeoff }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-success/30 bg-success/5 p-4">
          <h4 className="mb-2 text-sm font-semibold text-foreground">Advantages</h4>
          <ul className="space-y-1.5">
            {tradeoffs.advantages.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <Check size={14} className="mt-0.5 shrink-0 text-success" />
                {a}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-4">
          <h4 className="mb-2 text-sm font-semibold text-foreground">Trade-offs</h4>
          <ul className="space-y-1.5">
            {tradeoffs.disadvantages.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <X size={14} className="mt-0.5 shrink-0 text-danger" />
                {d}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">When to use it</h4>
        <p className="text-sm text-foreground">{tradeoffs.whenToUse}</p>
      </div>
    </div>
  );
}
