import * as React from "react";
import { Search, CornerDownLeft } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { SearchResultsList } from "./SearchResultsList";
import { searchTopics } from "@/data/topics";
import { useUIStore } from "@/store/useUIStore";
import { useNavigate } from "react-router-dom";

export function CommandPalette() {
  const { searchOpen, closeSearch, openSearch } = useUIStore();
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const results = React.useMemo(() => searchTopics(query, 8), [query]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearch();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openSearch]);

  React.useEffect(() => {
    if (searchOpen) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [searchOpen]);

  React.useEffect(() => setActiveIndex(0), [query]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const chosen = results[activeIndex];
      if (chosen) {
        navigate(`/topic/${chosen.topic.id}`);
        closeSearch();
      }
    }
  }

  return (
    <Dialog open={searchOpen} onClose={closeSearch} align="top">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Search size={18} className="shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search system design concepts…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">
          ESC
        </kbd>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {query.trim() ? (
          <SearchResultsList results={results} activeIndex={activeIndex} onNavigate={closeSearch} />
        ) : (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            Try <span className="text-foreground">redis</span>,{" "}
            <span className="text-foreground">database locking</span>, or{" "}
            <span className="text-foreground">kafka consumer</span>.
          </div>
        )}
      </div>
      <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <CornerDownLeft size={12} /> to select
        </span>
        <span>↑↓ to navigate</span>
      </div>
    </Dialog>
  );
}
