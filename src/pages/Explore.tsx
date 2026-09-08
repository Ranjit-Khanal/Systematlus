import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { HeroSearch } from "@/components/search/HeroSearch";
import { categories } from "@/data/categories";
import { getTopicsByCategory, getTopicById } from "@/data/topics";

const learningPaths = [
  {
    title: "Why can two people book the same seat?",
    description: "Follow the exact path from race condition to a real fix.",
    steps: ["database-locking", "optimistic-locking", "pessimistic-locking", "booking-system"],
  },
  {
    title: "How does Kafka actually move data?",
    description: "Producer → topic → partitions → consumer group → lag.",
    steps: ["kafka", "message-queues", "consumer-groups", "event-driven-architecture"],
  },
  {
    title: "Why does everyone put Redis in front of Postgres?",
    description: "The cache-aside pattern, and what happens when it fails.",
    steps: ["redis", "cache-aside", "cache-invalidation", "hot-keys"],
  },
];

export function Explore() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Explore</h1>
      <p className="mt-1 max-w-xl text-sm text-muted-foreground">
        Not sure where to start? Search for a concept, follow a guided path, or browse by category.
      </p>

      <div className="mt-6">
        <HeroSearch />
      </div>

      <section className="mt-12">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Guided paths</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {learningPaths.map((path) => (
            <div key={path.title} className="rounded-lg border border-border bg-card p-4">
              <h3 className="font-semibold text-foreground">{path.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{path.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {path.steps.map((id, i) => {
                  const t = getTopicById(id);
                  if (!t) return null;
                  return (
                    <span key={id} className="flex items-center gap-1.5">
                      <Link
                        to={`/topic/${id}`}
                        className="rounded-md border border-border bg-muted/50 px-2 py-1 text-xs font-medium text-foreground hover:border-accent-soft hover:bg-accent-soft"
                      >
                        {t.title}
                      </Link>
                      {i < path.steps.length - 1 && <ArrowRight size={11} className="text-muted-foreground" />}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Browse by category</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((cat) => {
            const topicsInCat = getTopicsByCategory(cat.id);
            return (
              <Link
                key={cat.id}
                to={cat.id === "real-world-systems" ? "/systems" : `/topics?category=${cat.id}`}
                className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-accent-soft hover:bg-muted/40"
              >
                <h3 className="font-semibold text-foreground">{cat.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{cat.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">{topicsInCat.length} topics</p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
