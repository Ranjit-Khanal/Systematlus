export function Legend() {
  const items = [
    { symbol: "□", label: "Service" },
    { symbol: "◇", label: "Database / Cache" },
    { symbol: "○", label: "External Service" },
    { symbol: "→", label: "Synchronous request" },
    { symbol: "⇢", label: "Async message" },
    { symbol: "⋯", label: "Optional dependency" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-xs text-muted-foreground">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className="font-mono text-sm text-foreground">{item.symbol}</span>
          {item.label}
        </span>
      ))}
    </div>
  );
}
