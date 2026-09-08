import * as React from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getTopicById, getRelatedTopics } from "@/data/topics";
import { getCategory } from "@/data/categories";
import { Badge } from "@/components/ui/Badge";
import { Sheet } from "@/components/ui/Sheet";
import { TopicSidebar, type SidebarSection } from "@/components/layout/TopicSidebar";
import { TopicSection } from "@/components/layout/TopicSection";
import { ArchitectureDiagram } from "@/components/architecture/ArchitectureDiagram";
import { NodeInspector } from "@/components/architecture/NodeInspector";
import { RequestFlow } from "@/components/requestFlow/RequestFlow";
import { CodeBlock } from "@/components/code/CodeBlock";
import { SchemaViewer } from "@/components/database/SchemaViewer";
import { TradeoffsList } from "@/components/tradeoffs/TradeoffsList";
import { FailureModes } from "@/components/failureModes/FailureModes";
import { ScalingSection } from "@/components/scaling/ScalingSection";
import { RelatedGraph } from "@/components/related/RelatedGraph";
import type { ArchitectureNode } from "@/types/topic";
import { NotFound } from "./NotFound";

const difficultyVariant = {
  beginner: "success",
  intermediate: "warning",
  advanced: "danger",
} as const;

export function TopicPage() {
  const { id } = useParams();
  const topic = id ? getTopicById(id) : undefined;

  const [selectedNode, setSelectedNode] = React.useState<ArchitectureNode | null>(null);
  const [activeNodeId, setActiveNodeId] = React.useState<string | null>(null);
  const architectureRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    window.scrollTo(0, 0);
    setSelectedNode(null);
    setActiveNodeId(null);
  }, [id]);

  if (!topic) return <NotFound />;

  const related = getRelatedTopics(topic);
  const category = getCategory(topic.category);
  const nodeLabelById: Record<string, string> = Object.fromEntries(
    (topic.architecture ?? []).map((n) => [n.id, n.label]),
  );

  const sections: SidebarSection[] = [
    { id: "overview", label: "Overview" },
    ...(topic.architecture ? [{ id: "architecture", label: "Architecture" }] : []),
    ...(topic.requestFlow ? [{ id: "request-flow", label: "Follow a Request" }] : []),
    ...(topic.implementations ? [{ id: "implementation", label: "Implementation" }] : []),
    ...(topic.database ? [{ id: "data-model", label: "Data Model" }] : []),
    ...(topic.tradeoffs ? [{ id: "tradeoffs", label: "Trade-offs" }] : []),
    ...(topic.failureModes ? [{ id: "failure-modes", label: "Failure Modes" }] : []),
    ...(topic.scaling ? [{ id: "scaling", label: "Scaling" }] : []),
    ...(related.length > 0 ? [{ id: "related", label: "Related Concepts" }] : []),
  ];

  function focusNode(nodeId: string) {
    setActiveNodeId(nodeId);
    architectureRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Link
        to={`/topics`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} /> Back to Topics
      </Link>

      <div className="flex gap-10">
        <TopicSidebar sections={sections} />

        <div className="min-w-0 flex-1">
          <header className="mb-2">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {category && <Badge variant="outline">{category.title}</Badge>}
              <Badge variant={difficultyVariant[topic.difficulty]}>{capitalize(topic.difficulty)}</Badge>
              {!topic.isDeepDive && <Badge variant="default">Lightweight entry</Badge>}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{topic.title}</h1>
          </header>

          <TopicSection id="overview" title="Overview">
            <p className="text-base leading-relaxed text-foreground">{topic.description}</p>

            {topic.concepts.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {topic.concepts.map((c) => (
                  <Badge key={c} variant="outline">
                    {c}
                  </Badge>
                ))}
              </div>
            )}

            {topic.howItWorks && (
              <ol className="mt-6 space-y-3">
                {topic.howItWorks.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm text-foreground">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            )}

            {!topic.isDeepDive && !topic.architecture && (
              <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                This is a lightweight entry. Deeper coverage — architecture, request flow, and code — is planned.
                Want to help? See{" "}
                <a href="https://github.com" target="_blank" rel="noreferrer" className="text-accent hover:underline">
                  CONTRIBUTING.md
                </a>{" "}
                to add it.
              </div>
            )}
          </TopicSection>

          {topic.architecture && topic.edges && (
            <TopicSection
              id="architecture"
              title="Architecture"
              description="Click any component to see its role, inputs, outputs, and failure behavior."
              ref={architectureRef}
            >
              <ArchitectureDiagram
                nodes={topic.architecture}
                edges={topic.edges}
                activeNodeId={activeNodeId}
                onNodeSelect={(node) => {
                  setSelectedNode(node);
                  setActiveNodeId(node.id);
                }}
              />
            </TopicSection>
          )}

          {topic.requestFlow && (
            <TopicSection
              id="request-flow"
              title="Follow a Request"
              description="Step through the request manually, or press Play to watch it move through the architecture above."
            >
              <RequestFlow steps={topic.requestFlow} nodeLabelById={nodeLabelById} onActiveNodeChange={setActiveNodeId} />
            </TopicSection>
          )}

          {topic.implementations && (
            <TopicSection id="implementation" title="Implementation">
              <div className="space-y-4">
                {topic.implementations.map((impl) => (
                  <CodeBlock
                    key={impl.id}
                    example={impl}
                    nodeLabelById={nodeLabelById}
                    onRelatedNodeClick={topic.architecture ? focusNode : undefined}
                  />
                ))}
              </div>
            </TopicSection>
          )}

          {topic.database && (
            <TopicSection id="data-model" title="Data Model">
              <SchemaViewer schema={topic.database} />
            </TopicSection>
          )}

          {topic.tradeoffs && (
            <TopicSection id="tradeoffs" title="Trade-offs">
              <TradeoffsList tradeoffs={topic.tradeoffs} />
            </TopicSection>
          )}

          {topic.failureModes && (
            <TopicSection id="failure-modes" title="Failure Modes">
              <FailureModes modes={topic.failureModes} />
            </TopicSection>
          )}

          {topic.scaling && (
            <TopicSection id="scaling" title="Scaling">
              <ScalingSection stages={topic.scaling} />
            </TopicSection>
          )}

          {related.length > 0 && (
            <TopicSection id="related" title="Related Concepts">
              <RelatedGraph topic={topic} related={related} />
            </TopicSection>
          )}
        </div>
      </div>

      <Sheet open={Boolean(selectedNode)} onClose={() => setSelectedNode(null)} title="Component details">
        {selectedNode && <NodeInspector node={selectedNode} />}
      </Sheet>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
