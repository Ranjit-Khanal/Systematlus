import * as React from "react";
import { cn } from "@/lib/utils";

export interface SidebarSection {
  id: string;
  label: string;
}

export function TopicSidebar({ sections }: { sections: SidebarSection[] }) {
  const [active, setActive] = React.useState(sections[0]?.id);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          setActive(visible[0].target.id);
        }
      },
      { rootMargin: "-100px 0px -70% 0px" },
    );

    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav className="sticky top-20 hidden max-h-[calc(100vh-6rem)] w-48 shrink-0 overflow-y-auto lg:block">
      <ul className="space-y-0.5 border-l border-border pl-3">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className={cn(
                "-ml-[13px] block border-l-2 py-1 pl-3 text-sm transition-colors",
                active === s.id
                  ? "border-accent font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
