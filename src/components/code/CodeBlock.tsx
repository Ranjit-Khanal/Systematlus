import * as React from "react";
import { Check, Copy, FileCode2 } from "lucide-react";
import type { CodeExample } from "@/types/topic";
import { highlight } from "@/lib/highlight";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  example: CodeExample;
  nodeLabelById?: Record<string, string>;
  onRelatedNodeClick?: (nodeId: string) => void;
}

export function CodeBlock({ example, nodeLabelById, onRelatedNodeClick }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);
  const tokens = React.useMemo(() => highlight(example.code, example.language), [example.code, example.language]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(example.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard access denied — silently ignore
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/50 px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <FileCode2 size={13} className="text-muted-foreground" />
          <span className="font-mono text-foreground">{example.filename}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {example.language}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {example.description && (
        <div className="border-b border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          {example.description}
        </div>
      )}

      <pre className="overflow-x-auto bg-code-bg px-4 py-3 text-[13px] leading-relaxed">
        <code className="font-mono">
          {tokens.map((t, i) => (
            <span key={i} className={t.cls ? `tok-${t.cls}` : undefined}>
              {t.text}
            </span>
          ))}
        </code>
      </pre>

      {example.relatedNodes && example.relatedNodes.length > 0 && nodeLabelById && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border bg-muted/30 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Used by:</span>
          {example.relatedNodes.map((nodeId, i) => (
            <React.Fragment key={nodeId}>
              {i > 0 && <span className="text-muted-foreground">→</span>}
              <button
                onClick={() => onRelatedNodeClick?.(nodeId)}
                className={cn(
                  "rounded px-1.5 py-0.5 font-mono text-foreground transition-colors hover:bg-accent-soft",
                  onRelatedNodeClick && "cursor-pointer",
                )}
              >
                {nodeLabelById[nodeId] ?? nodeId}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
