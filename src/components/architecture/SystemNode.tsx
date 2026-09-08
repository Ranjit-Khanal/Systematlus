import { Handle, Position, type NodeProps } from "reactflow";
import { cn } from "@/lib/utils";
import { roleIcon, roleLabel } from "./nodeIcons";
import type { NodeRole } from "@/types/topic";

export interface SystemNodeData {
  label: string;
  role: NodeRole;
  optional?: boolean;
  active?: boolean;
  dimmed?: boolean;
}

export function SystemNode({ data }: NodeProps<SystemNodeData>) {
  const Icon = roleIcon[data.role];

  return (
    <div
      className={cn(
        "flex w-[160px] flex-col items-center gap-1.5 rounded-lg border-2 bg-node-bg px-3 py-2.5 text-center shadow-sm transition-all",
        data.optional ? "border-dashed border-node-border" : "border-node-border",
        data.active && "border-accent shadow-[0_0_0_4px_var(--color-accent-soft)]",
        data.dimmed && "opacity-40",
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-edge !border-0 !w-2 !h-2" />
      <Handle type="target" position={Position.Left} className="!bg-edge !border-0 !w-2 !h-2" />
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md",
          data.active ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon size={16} />
      </div>
      <div className="text-xs font-medium leading-tight text-foreground">{data.label}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{roleLabel[data.role]}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-edge !border-0 !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-edge !border-0 !w-2 !h-2" />
    </div>
  );
}

export const nodeTypes = { system: SystemNode };
