import { useNavigate } from "react-router-dom";
import type { Topic } from "@/types/topic";

interface RelatedGraphProps {
  topic: Topic;
  related: Topic[];
}

const WIDTH = 700;
const HEIGHT = 380;
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };
const RADIUS = Math.min(WIDTH, HEIGHT) / 2 - 40;

export function RelatedGraph({ topic, related }: RelatedGraphProps) {
  const navigate = useNavigate();

  if (related.length === 0) return null;

  const points = related.map((t, i) => {
    const angle = (i / related.length) * Math.PI * 2 - Math.PI / 2;
    return {
      topic: t,
      x: CENTER.x + RADIUS * Math.cos(angle),
      y: CENTER.y + RADIUS * Math.sin(angle),
    };
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-panel py-4">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="mx-auto w-full max-w-2xl">
        {points.map((p) => (
          <line
            key={`line-${p.topic.id}`}
            x1={CENTER.x}
            y1={CENTER.y}
            x2={p.x}
            y2={p.y}
            stroke="var(--color-edge)"
            strokeWidth={1.5}
          />
        ))}

        <foreignObject x={CENTER.x - 70} y={CENTER.y - 20} width={140} height={40}>
          <div className="flex h-full items-center justify-center rounded-md border-2 border-accent bg-accent-soft px-2 text-center text-xs font-semibold text-foreground">
            {topic.title}
          </div>
        </foreignObject>

        {points.map((p) => (
          <foreignObject key={`node-${p.topic.id}`} x={p.x - 65} y={p.y - 18} width={130} height={36}>
            <button
              onClick={() => navigate(`/topic/${p.topic.id}`)}
              className="flex h-full w-full items-center justify-center rounded-md border border-node-border bg-node-bg px-2 text-center text-[11px] font-medium text-foreground transition-colors hover:border-accent hover:bg-accent-soft"
            >
              {p.topic.title}
            </button>
          </foreignObject>
        ))}
      </svg>
    </div>
  );
}
