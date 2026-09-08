import * as React from "react";

interface TopicSectionProps {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export const TopicSection = React.forwardRef<HTMLElement, TopicSectionProps>(
  ({ id, title, description, children }, ref) => {
    return (
      <section id={id} ref={ref} className="scroll-mt-24 border-b border-border py-8 first:pt-0 last:border-0">
        <h2 className="mb-1 text-xl font-semibold tracking-tight text-foreground">{title}</h2>
        {description && <p className="mb-4 text-sm text-muted-foreground">{description}</p>}
        <div className={description ? "mt-4" : "mt-3"}>{children}</div>
      </section>
    );
  },
);
TopicSection.displayName = "TopicSection";
