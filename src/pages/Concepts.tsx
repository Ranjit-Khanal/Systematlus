import * as React from "react";
import { Link } from "react-router-dom";
import { topics } from "@/data/topics";
import { getCategory } from "@/data/categories";
import { Badge } from "@/components/ui/Badge";

export function Concepts() {
  const sorted = [...topics].sort((a, b) => a.title.localeCompare(b.title));
  const groups = React.useMemo(() => {
    const map = new Map<string, typeof sorted>();
    for (const t of sorted) {
      const letter = t.title[0].toUpperCase();
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(t);
    }
    return map;
  }, [sorted]);
  const letters = Array.from(groups.keys());

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Concepts</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        A flat, alphabetical glossary of every concept covered in SystemAtlas — {topics.length} entries.
      </p>

      <div className="mt-6 flex flex-wrap gap-1.5 border-b border-border pb-6">
        {letters.map((l) => (
          <a
            key={l}
            href={`#letter-${l}`}
            className="flex h-6 w-6 items-center justify-center rounded text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {l}
          </a>
        ))}
      </div>

      <div className="divide-y divide-border">
        {letters.map((letter) => (
          <div key={letter} id={`letter-${letter}`} className="scroll-mt-20 py-4">
            <div className="mb-2 font-mono text-sm font-semibold text-accent">{letter}</div>
            <ul className="space-y-2">
              {groups.get(letter)!.map((t) => {
                const category = getCategory(t.category);
                return (
                  <li key={t.id}>
                    <Link to={`/topic/${t.id}`} className="group flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="whitespace-nowrap font-medium text-foreground group-hover:text-accent">
                          {t.title}
                        </span>
                        {category && (
                          <Badge variant="outline" className="shrink-0">
                            {category.title}
                          </Badge>
                        )}
                      </span>
                      <span className="truncate text-sm text-muted-foreground">{t.description}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
