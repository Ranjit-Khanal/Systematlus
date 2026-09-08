import { NavLink } from "react-router-dom";
import { Search, Moon, Sun, Layers } from "lucide-react";
import { GithubMark } from "@/components/icons/GithubMark";
import { useUIStore } from "@/store/useUIStore";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/explore", label: "Explore" },
  { to: "/topics", label: "Topics" },
  { to: "/systems", label: "Systems" },
  { to: "/concepts", label: "Concepts" },
  { to: "/about", label: "About" },
];

export function Header() {
  const { theme, toggleTheme, openSearch } = useUIStore();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <NavLink to="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          <Layers size={20} className="text-accent" />
          <span className="hidden sm:inline">SystemAtlas</span>
        </NavLink>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                  isActive && "text-foreground",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={openSearch}
          className="ml-auto flex w-full max-w-xs items-center gap-2 rounded-md border border-border bg-muted/60 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-accent-soft hover:text-foreground"
        >
          <Search size={14} />
          <span className="hidden sm:inline">Search concepts…</span>
          <span className="sm:hidden">Search…</span>
          <kbd className="ml-auto hidden rounded border border-border px-1.5 py-0.5 text-[10px] sm:block">⌘K</kbd>
        </button>

        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub"
          className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <GithubMark size={16} />
        </a>
      </div>

      <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-4 py-1.5 md:hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "shrink-0 rounded-md px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                isActive && "bg-muted text-foreground",
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
