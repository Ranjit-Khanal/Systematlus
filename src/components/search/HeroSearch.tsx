import * as React from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { searchTopics } from "@/data/topics";
import { SearchResultsList } from "./SearchResultsList";
import { cn } from "@/lib/utils";

export function HeroSearch() {
  const [query, setQuery] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const results = React.useMemo(() => searchTopics(query, 6), [query]);
  const showDropdown = focused && query.trim().length > 0;

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (results[0]) {
      navigate(`/topic/${results[0].topic.id}`);
      setFocused(false);
    }
  }

  return (
    <div ref={containerRef} className="relative mx-auto w-full max-w-xl">
      <form onSubmit={handleSubmit}>
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm transition-colors",
            focused && "border-accent",
          )}
        >
          <Search size={18} className="shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder="Search system design concepts… (Redis, Kafka, rate limiting)"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">
            ⌘K
          </kbd>
        </div>
      </form>
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-96 overflow-y-auto rounded-lg border border-border bg-card shadow-2xl">
          <SearchResultsList results={results} onNavigate={() => setFocused(false)} />
        </div>
      )}
    </div>
  );
}
