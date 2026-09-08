import { Link } from "react-router-dom";
import { HeroSearch } from "@/components/search/HeroSearch";
import { TopicCard } from "@/components/topic/TopicCard";
import { categories } from "@/data/categories";
import { getTopicById, getPopularTopicIds, getFeaturedSystemIds, getTopicsByCategory } from "@/data/topics";

export function Home() {
  const popular = getPopularTopicIds()
    .map(getTopicById)
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const featured = getFeaturedSystemIds()
    .map(getTopicById)
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  return (
    <div>
      <section className="border-b border-border">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Understand backend systems visually.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
            Explore how modern backend systems work — from a single request to distributed architecture.
          </p>
          <div className="mt-8">
            <HeroSearch />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeading title="Popular Topics" />
        <div className="flex flex-wrap gap-2">
          {popular.map((topic) => (
            <Link
              key={topic.id}
              to={`/topic/${topic.id}`}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-accent-soft hover:bg-muted"
            >
              {topic.title}
            </Link>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-panel/50">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <SectionHeading title="Explore by Category" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((cat) => {
              const count = getTopicsByCategory(cat.id).length;
              return (
                <Link
                  key={cat.id}
                  to={`/topics?category=${cat.id}`}
                  className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-accent-soft hover:bg-muted/40"
                >
                  <h3 className="font-semibold text-foreground">{cat.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{cat.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{count} topics</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <SectionHeading title="Featured Systems" description="How production systems combine these building blocks." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </div>
      </section>
    </div>
  );
}

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
