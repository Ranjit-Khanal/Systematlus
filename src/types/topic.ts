// Core content model. Everything a topic page renders is derived from a
// single Topic object — UI components never hard-code content.

export type Difficulty = "beginner" | "intermediate" | "advanced";

export type NodeRole =
  | "client"
  | "service"
  | "database"
  | "cache"
  | "queue"
  | "external"
  | "loadbalancer"
  | "gateway"
  | "worker"
  | "storage";

export interface ArchitectureNode {
  id: string;
  label: string;
  role: NodeRole;
  /** Grid-ish position; the renderer uses these as React Flow coordinates. */
  x: number;
  y: number;
  /** Short one-line description shown as a hint before opening the inspector. */
  summary?: string;
  /** Rich detail shown in the click-to-inspect side panel. */
  detail?: NodeDetail;
  optional?: boolean;
}

export interface NodeDetail {
  role: string;
  why: string;
  input?: string;
  output?: string;
  operations?: string[];
  failure?: string;
  related?: string[];
}

export type EdgeKind = "sync" | "async" | "optional";

export interface ArchitectureEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  kind?: EdgeKind;
}

export interface RequestStep {
  id: string;
  nodeId: string;
  title: string;
  description: string;
  operation?: string;
  outcome?: string;
  latencyMs?: number;
}

export interface CodeExample {
  id: string;
  filename: string;
  language: string;
  description?: string;
  code: string;
  /** Ids of architecture nodes this snippet corresponds to, in call order. */
  relatedNodes?: string[];
}

export interface DatabaseColumn {
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  isIndexed?: boolean;
  note?: string;
}

export interface DatabaseTable {
  name: string;
  columns: DatabaseColumn[];
  exampleRows?: Record<string, string | number>[];
  indexNote?: {
    before: string;
    after: string;
    explanation: string;
  };
}

export interface DatabaseSchema {
  tables: DatabaseTable[];
}

export interface Tradeoff {
  advantages: string[];
  disadvantages: string[];
  whenToUse: string;
}

export interface FailureMode {
  id: string;
  title: string;
  scenario: string;
  path: string[]; // sequence of node ids/labels representing the broken path
  explanation: string;
  consequences: string[];
}

export interface ScalingStage {
  id: string;
  title: string;
  description: string;
  nodes: string[]; // simplified label chain for this stage's mini-diagram
  problem?: string;
  solution?: string;
  tradeoff?: string;
}

export interface RelatedLink {
  topicId: string;
  label: string;
}

export interface Topic {
  id: string;
  title: string;
  category: string;
  difficulty: Difficulty;
  description: string;
  concepts: string[];

  /** True for the 12 flagship deep-dive topics; false for lightweight stubs. */
  isDeepDive: boolean;

  architecture?: ArchitectureNode[];
  edges?: ArchitectureEdge[];
  requestFlow?: RequestStep[];
  implementations?: CodeExample[];
  database?: DatabaseSchema;
  tradeoffs?: Tradeoff;
  failureModes?: FailureMode[];
  scaling?: ScalingStage[];
  relatedTopics?: string[];

  howItWorks?: string[];
}

export interface CategoryInfo {
  id: string;
  title: string;
  description: string;
}
