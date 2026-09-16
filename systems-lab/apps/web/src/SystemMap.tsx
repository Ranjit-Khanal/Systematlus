import type { LabEvent } from "./types";

const NODES = [
  { id: "application", label: "APPLICATION", x: 220, y: 24, w: 160, h: 44 },
  { id: "go_runtime", label: "GO RUNTIME", x: 220, y: 100, w: 160, h: 44 },
  { id: "syscall", label: "SYSCALL", x: 220, y: 176, w: 160, h: 44 },
  { id: "kernel", label: "LINUX KERNEL", x: 200, y: 260, w: 200, h: 56 },
  { id: "process", label: "PROCESS MGMT", x: 40, y: 360, w: 140, h: 40 },
  { id: "memory", label: "VIRTUAL MEMORY", x: 210, y: 360, w: 150, h: 40 },
  { id: "vfs", label: "VFS / FS", x: 390, y: 360, w: 130, h: 40 },
  { id: "net", label: "NET STACK", x: 220, y: 440, w: 160, h: 40 },
] as const;

const EDGES: [string, string][] = [
  ["application", "go_runtime"],
  ["go_runtime", "syscall"],
  ["syscall", "kernel"],
  ["kernel", "process"],
  ["kernel", "memory"],
  ["kernel", "vfs"],
  ["kernel", "net"],
];

function nodeCenter(id: string) {
  const n = NODES.find((x) => x.id === id)!;
  return { x: n.x + n.w / 2, y: n.y + n.h / 2 };
}

type Props = {
  events: LabEvent[];
  selectedLayer: string | null;
  onSelectLayer: (id: string) => void;
};

export function SystemMap({ events, selectedLayer, onSelectLayer }: Props) {
  const recent = events.slice(-12);
  const active = new Set<string>();
  for (const e of recent) {
    if (e.layer) active.add(e.layer);
    if (e.kind === "map_pulse" && e.layer) active.add(e.layer);
  }
  // Map educational aliases
  if (active.has("vfs")) active.add("vfs");

  return (
    <div className="map-wrap">
      <svg className="map-svg" viewBox="0 0 560 500" role="img" aria-label="System map">
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#2a3548" />
          </marker>
        </defs>
        {EDGES.map(([a, b]) => {
          const A = nodeCenter(a);
          const B = nodeCenter(b);
          const pulsing = active.has(a) || active.has(b);
          return (
            <line
              key={`${a}-${b}`}
              className={`edge${pulsing ? " pulse" : ""}`}
              x1={A.x}
              y1={A.y + 18}
              x2={B.x}
              y2={B.y - 18}
            />
          );
        })}
        {NODES.map((n) => {
          const isActive = active.has(n.id) || selectedLayer === n.id;
          return (
            <g key={n.id} style={{ cursor: "pointer" }} onClick={() => onSelectLayer(n.id)}>
              <rect className={`node${isActive ? " active" : ""}`} x={n.x} y={n.y} width={n.w} height={n.h} rx={6} />
              <text className="label" x={n.x + n.w / 2} y={n.y + n.h / 2 + 4} textAnchor="middle">
                {n.label}
              </text>
            </g>
          );
        })}
        <text className="sub" x={280} y={495} textAnchor="middle">
          Pulsing edges = SIMULATION animation driven by recent REAL events
        </text>
      </svg>
    </div>
  );
}
