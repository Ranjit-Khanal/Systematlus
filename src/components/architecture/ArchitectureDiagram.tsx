import * as React from "react";
import ReactFlow, {
  Background,
  Controls,
  ReactFlowProvider,
  MarkerType,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import type { ArchitectureEdge, ArchitectureNode } from "@/types/topic";
import { nodeTypes, type SystemNodeData } from "./SystemNode";
import { Legend } from "./Legend";

interface ArchitectureDiagramProps {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  activeNodeId?: string | null;
  onNodeSelect?: (node: ArchitectureNode) => void;
  className?: string;
  height?: number;
}

function buildFlowNodes(nodes: ArchitectureNode[], activeNodeId?: string | null): Node<SystemNodeData>[] {
  return nodes.map((n) => ({
    id: n.id,
    type: "system",
    position: { x: n.x, y: n.y },
    data: {
      label: n.label,
      role: n.role,
      optional: n.optional,
      active: activeNodeId === n.id,
      dimmed: Boolean(activeNodeId) && activeNodeId !== n.id,
    },
    draggable: false,
  }));
}

function buildFlowEdges(edges: ArchitectureEdge[], activeNodeId?: string | null): Edge[] {
  return edges.map((e) => {
    const isAsync = e.kind === "async";
    const isOptional = e.kind === "optional";
    const isHighlighted = activeNodeId && (e.source === activeNodeId || e.target === activeNodeId);

    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      animated: isAsync,
      style: {
        strokeWidth: isHighlighted ? 2.5 : 1.5,
        strokeDasharray: isOptional ? "3 4" : isAsync ? "5 4" : undefined,
        opacity: activeNodeId ? (isHighlighted ? 1 : 0.35) : 1,
      },
      labelStyle: { fontSize: 11, fill: "var(--color-muted-foreground)" },
      labelBgStyle: { fill: "var(--color-background)", fillOpacity: 0.9 },
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    };
  });
}

export function ArchitectureDiagram({
  nodes,
  edges,
  activeNodeId,
  onNodeSelect,
  className,
  height = 440,
}: ArchitectureDiagramProps) {
  const flowNodes = React.useMemo(() => buildFlowNodes(nodes, activeNodeId), [nodes, activeNodeId]);
  const flowEdges = React.useMemo(() => buildFlowEdges(edges, activeNodeId), [edges, activeNodeId]);

  const nodesById = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  return (
    <div className={className}>
      <ReactFlowProvider>
        <div style={{ height }} className="overflow-hidden rounded-lg border border-border bg-panel">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => {
              const orig = nodesById.get(node.id);
              if (orig) onNodeSelect?.(orig);
            }}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            proOptions={{ hideAttribution: true }}
            minZoom={0.4}
            maxZoom={1.5}
            panOnScroll
            zoomOnPinch
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
          >
            <Background gap={20} size={1} color="var(--color-border)" />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </ReactFlowProvider>
      <div className="mt-2">
        <Legend />
      </div>
    </div>
  );
}
