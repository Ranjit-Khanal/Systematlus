import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { categories } from "@/data/categories";
import { getTopicsByCategory } from "@/data/topics";
import { TopicCard } from "@/components/topic/TopicCard";
import { cn } from "@/lib/utils";

const libraryCategories = categories.filter((c) => c.id !== "real-world-systems");

export function Topics() {
  const [params, setParams] = useSearchParams();
  const activeCategory = params.get("category");

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Topics</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        The core building blocks of backend systems, organized by category.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <FilterChip active={!activeCategory} onClick={() => setParams({})}>
          All
        </FilterChip>
        {libraryCategories.map((cat) => (
          <FilterChip key={cat.id} active={activeCategory === cat.id} onClick={() => setParams({ category: cat.id })}>
            {cat.title}
          </FilterChip>
        ))}
      </div>

      <div className="mt-8 space-y-10">
        {(activeCategory ? libraryCategories.filter((c) => c.id === activeCategory) : libraryCategories).map((cat) => {
          const topicsInCat = getTopicsByCategory(cat.id);
          if (topicsInCat.length === 0) return null;
          return (
            <section key={cat.id}>
              <h2 className="text-lg font-semibold text-foreground">{cat.title}</h2>
              <p className="mb-4 mt-0.5 text-sm text-muted-foreground">{cat.description}</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {topicsInCat.map((t) => (
                  <TopicCard key={t.id} topic={t} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-accent bg-accent-soft text-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
