import type { CategoryInfo } from "@/types/topic";

export const categories: CategoryInfo[] = [
  {
    id: "architecture",
    title: "Architecture",
    description: "How services are structured and talk to each other.",
  },
  {
    id: "networking",
    title: "Networking",
    description: "How data moves between clients, servers, and the internet.",
  },
  {
    id: "databases",
    title: "Databases",
    description: "Storage engines, transactions, indexing, and scaling data.",
  },
  {
    id: "caching",
    title: "Caching",
    description: "Keeping hot data close and fast.",
  },
  {
    id: "messaging",
    title: "Messaging",
    description: "Queues, streams, and event-driven communication.",
  },
  {
    id: "distributed-systems",
    title: "Distributed Systems",
    description: "Consistency, coordination, and consensus across machines.",
  },
  {
    id: "reliability",
    title: "Reliability",
    description: "Keeping systems working when parts of them fail.",
  },
  {
    id: "real-world-systems",
    title: "Real-World Systems",
    description: "How production systems combine these building blocks.",
  },
];

export function getCategory(id: string): CategoryInfo | undefined {
  return categories.find((c) => c.id === id);
}
