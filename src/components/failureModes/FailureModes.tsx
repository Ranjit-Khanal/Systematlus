import { AlertTriangle, ArrowRight, XCircle } from "lucide-react";
import type { FailureMode } from "@/types/topic";

export function FailureModes({ modes }: { modes: FailureMode[] }) {
  return (
    <div className="space-y-4">
      {modes.map((mode) => (
        <div key={mode.id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" />
            <div>
              <h4 className="text-sm font-semibold text-foreground">{mode.title}</h4>
              <p className="mt-0.5 text-sm text-muted-foreground">{mode.scenario}</p>
            </div>
          </div>

          <div className="my-3 flex flex-wrap items-center gap-1.5 rounded-md bg-muted/50 px-3 py-2">
            {mode.path.map((step, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span className="font-mono text-xs text-foreground">{step}</span>
                {i === mode.path.length - 1 ? (
                  <XCircle size={12} className="text-danger" />
                ) : (
                  i < mode.path.length - 1 && <ArrowRight size={12} className="text-muted-foreground" />
                )}
              </span>
            ))}
          </div>

          <p className="text-sm text-foreground">{mode.explanation}</p>

          <ul className="mt-2 space-y-1">
            {mode.consequences.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
