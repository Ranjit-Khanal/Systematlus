import * as React from "react";
import { ChevronLeft, ChevronRight, RotateCcw, Play, Pause, Info } from "lucide-react";
import type { RequestStep } from "@/types/topic";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface RequestFlowProps {
  steps: RequestStep[];
  nodeLabelById: Record<string, string>;
  onActiveNodeChange: (nodeId: string | null) => void;
}

const PLAY_STEP_MS = 1400;

export function RequestFlow({ steps, nodeLabelById, onActiveNodeChange }: RequestFlowProps) {
  const [index, setIndex] = React.useState<number | null>(null);
  const [playing, setPlaying] = React.useState(false);

  React.useEffect(() => {
    onActiveNodeChange(index !== null ? steps[index]?.nodeId ?? null : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  React.useEffect(() => {
    if (!playing) return;
    if (index === null) {
      setIndex(0);
      return;
    }
    if (index >= steps.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setIndex((i) => (i ?? 0) + 1), PLAY_STEP_MS);
    return () => clearTimeout(t);
  }, [playing, index, steps.length]);

  const current = index !== null ? steps[index] : null;

  function reset() {
    setPlaying(false);
    setIndex(null);
  }

  function next() {
    setPlaying(false);
    setIndex((i) => (i === null ? 0 : Math.min(i + 1, steps.length - 1)));
  }

  function prev() {
    setPlaying(false);
    setIndex((i) => (i === null ? 0 : Math.max(i - 1, 0)));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((step, i) => (
          <button
            key={step.id}
            onClick={() => {
              setPlaying(false);
              setIndex(i);
            }}
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors",
              index === i
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border bg-muted text-muted-foreground hover:text-foreground",
            )}
            aria-label={`Step ${i + 1}: ${step.title}`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <div className="min-h-[168px] rounded-lg border border-border bg-card p-4">
        {current ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">
                Step {(index ?? 0) + 1}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {nodeLabelById[current.nodeId] ?? current.nodeId}
              </span>
            </div>
            <h4 className="text-sm font-semibold text-foreground">{current.title}</h4>
            <p className="text-sm text-muted-foreground">{current.description}</p>
            {current.operation && (
              <code className="mt-1 block w-fit rounded bg-code-bg px-2 py-1 text-xs">{current.operation}</code>
            )}
            {current.outcome && (
              <div className="text-xs text-foreground">
                <span className="text-muted-foreground">Result: </span>
                {current.outcome}
              </div>
            )}
            {typeof current.latencyMs === "number" && (
              <div className="flex items-center gap-1 pt-1 text-[11px] text-muted-foreground">
                <Info size={11} />
                ~{current.latencyMs}ms — illustrative latency, not a benchmark
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Click a step, or press Play, to follow the request through the architecture.
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={prev} disabled={index === null || index === 0}>
          <ChevronLeft size={14} /> Previous
        </Button>
        <Button variant="outline" size="sm" onClick={next} disabled={index !== null && index >= steps.length - 1}>
          Next <ChevronRight size={14} />
        </Button>
        <Button variant="ghost" size="sm" onClick={reset}>
          <RotateCcw size={14} /> Reset
        </Button>
        <Button
          variant={playing ? "subtle" : "default"}
          size="sm"
          className="ml-auto"
          onClick={() => setPlaying((p) => !p)}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
          {playing ? "Pause" : "Play request"}
        </Button>
      </div>
    </div>
  );
}
