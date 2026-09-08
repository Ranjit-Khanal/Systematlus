import { Link } from "react-router-dom";
import { ArrowRight, AlertTriangle } from "lucide-react";
import type { ArchitectureNode } from "@/types/topic";
import { getTopicById } from "@/data/topics";
import { Badge } from "@/components/ui/Badge";
import { roleIcon, roleLabel } from "./nodeIcons";

interface NodeInspectorProps {
  node: ArchitectureNode;
}

export function NodeInspector({ node }: NodeInspectorProps) {
  const detail = node.detail;
  const Icon = roleIcon[node.role];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent-soft text-foreground">
          <Icon size={18} />
        </div>
        <div>
          <div className="font-semibold">{node.label}</div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{roleLabel[node.role]}</div>
        </div>
      </div>

      {node.summary && <p className="text-sm text-muted-foreground">{node.summary}</p>}

      {detail && (
        <>
          <Section title="Why is it here?">
            <p className="text-sm text-foreground">{detail.why}</p>
          </Section>

          {(detail.input || detail.output) && (
            <div className="grid grid-cols-2 gap-3">
              {detail.input && (
                <Section title="Input">
                  <code className="block rounded bg-code-bg px-2 py-1.5 text-xs">{detail.input}</code>
                </Section>
              )}
              {detail.output && (
                <Section title="Output">
                  <code className="block rounded bg-code-bg px-2 py-1.5 text-xs">{detail.output}</code>
                </Section>
              )}
            </div>
          )}

          {detail.operations && detail.operations.length > 0 && (
            <Section title="Typical operations">
              <div className="flex flex-wrap gap-1.5">
                {detail.operations.map((op) => (
                  <Badge key={op} variant="outline" className="font-mono">
                    {op}
                  </Badge>
                ))}
              </div>
            </Section>
          )}

          {detail.failure && (
            <Section title="Failure">
              <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 p-2.5">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-danger" />
                <p className="text-sm text-foreground">{detail.failure}</p>
              </div>
            </Section>
          )}

          {detail.related && detail.related.length > 0 && (
            <Section title="Related">
              <div className="flex flex-col gap-1">
                {detail.related.map((relId) => {
                  const relTopic = getTopicById(relId);
                  return (
                    <Link
                      key={relId}
                      to={relTopic ? `/topic/${relTopic.id}` : "#"}
                      className="flex items-center gap-1.5 text-sm text-accent hover:underline"
                    >
                      <ArrowRight size={12} />
                      {relTopic?.title ?? relId}
                    </Link>
                  );
                })}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}
