import type { ScalingStage } from "@/types/topic";
import { ArrowRight, ArrowDown } from "lucide-react";

export function ScalingSection({ stages }: { stages: ScalingStage[] }) {
  return (
    <div className="space-y-6">
      {stages.map((stage, i) => (
        <div key={stage.id} className="relative">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-foreground">
              {i + 1}
            </span>
            <h4 className="text-sm font-semibold text-foreground">{stage.title}</h4>
          </div>

          <p className="mb-3 mt-1 pl-8 text-sm text-muted-foreground">{stage.description}</p>

          <div className="ml-8 flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-panel px-3 py-2.5">
            {stage.nodes.map((node, j) => (
              <span key={j} className="flex items-center gap-1.5">
                <span className="rounded border border-node-border bg-node-bg px-2 py-1 font-mono text-xs text-foreground">
                  {node}
                </span>
                {j < stage.nodes.length - 1 && <ArrowRight size={12} className="text-muted-foreground" />}
              </span>
            ))}
          </div>

          {(stage.problem || stage.solution || stage.tradeoff) && (
            <div className="ml-8 mt-3 grid gap-2 sm:grid-cols-3">
              {stage.problem && (
                <div className="rounded-md border border-border bg-card p-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Problem</div>
                  <p className="mt-0.5 text-xs text-foreground">{stage.problem}</p>
                </div>
              )}
              {stage.solution && (
                <div className="rounded-md border border-success/30 bg-success/5 p-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Solution</div>
                  <p className="mt-0.5 text-xs text-foreground">{stage.solution}</p>
                </div>
              )}
              {stage.tradeoff && (
                <div className="rounded-md border border-warning/30 bg-warning/5 p-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Trade-off</div>
                  <p className="mt-0.5 text-xs text-foreground">{stage.tradeoff}</p>
                </div>
              )}
            </div>
          )}

          {i < stages.length - 1 && (
            <div className="ml-[calc(0.75rem-0.5px)] flex h-6 items-center">
              <ArrowDown size={14} className="text-muted-foreground" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
