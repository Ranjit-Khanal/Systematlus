import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { Topic } from "@/types/topic";
import { getCategory } from "@/data/categories";
import { Badge } from "@/components/ui/Badge";

const difficultyVariant = {
  beginner: "success",
  intermediate: "warning",
  advanced: "danger",
} as const;

export function TopicCard({ topic }: { topic: Topic }) {
  const category = getCategory(topic.category);

  return (
    <Link
      to={`/topic/${topic.id}`}
      className="group flex flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-accent-soft hover:bg-muted/40"
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {category && <Badge variant="outline">{category.title}</Badge>}
        <Badge variant={difficultyVariant[topic.difficulty]}>{capitalize(topic.difficulty)}</Badge>
      </div>
      <h3 className="font-semibold text-foreground">{topic.title}</h3>
      <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">{topic.description}</p>
      <span className="mt-3 flex items-center gap-1 text-sm font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
        Explore <ArrowRight size={14} />
      </span>
    </Link>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
