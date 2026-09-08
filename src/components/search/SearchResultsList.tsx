import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { SearchResult } from "@/data/topics";
import { getCategory } from "@/data/categories";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

interface SearchResultsListProps {
  results: SearchResult[];
  activeIndex?: number;
  onNavigate?: () => void;
}

const difficultyLabel: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export function SearchResultsList({ results, activeIndex = -1, onNavigate }: SearchResultsListProps) {
  const navigate = useNavigate();

  if (results.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-muted-foreground">
        No matches. Try a different term — e.g. "locking", "kafka consumer", "rate limiting".
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {results.map(({ topic }, i) => {
        const category = getCategory(topic.category);
        return (
          <li key={topic.id}>
            <button
              type="button"
              onClick={() => {
                navigate(`/topic/${topic.id}`);
                onNavigate?.();
              }}
              className={cn(
                "group flex w-full items-start justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-muted",
                i === activeIndex && "bg-muted",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{topic.title}</span>
                  <Badge variant="outline">{category?.title ?? topic.category}</Badge>
                  <Badge variant="default">{difficultyLabel[topic.difficulty]}</Badge>
                </div>
                <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{topic.description}</p>
              </div>
              <ArrowRight
                size={16}
                className="mt-1 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
