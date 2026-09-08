import { getTopicsByCategory } from "@/data/topics";
import { TopicCard } from "@/components/topic/TopicCard";

export function Systems() {
  const systems = getTopicsByCategory("real-world-systems");

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Real-World Systems</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        See how the building blocks in Topics combine into complete systems — the kind of designs you'd sketch in a
        system-design interview.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {systems.map((t) => (
          <TopicCard key={t.id} topic={t} />
        ))}
      </div>
    </div>
  );
}
