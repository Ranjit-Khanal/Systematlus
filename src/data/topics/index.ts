import type { Topic } from "@/types/topic";

import { loadBalancer } from "./load-balancer";
import { apiGateway } from "./api-gateway";
import { postgresqlIndexing } from "./postgresql-indexing";
import { databaseTransactions } from "./database-transactions";
import { databaseLocking } from "./database-locking";
import { databaseReplication } from "./database-replication";
import { redis } from "./redis";
import { cacheAside } from "./cache-aside";
import { cacheInvalidation } from "./cache-invalidation";
import { rateLimiting } from "./rate-limiting";
import { distributedLocks } from "./distributed-locks";
import { eventualConsistency } from "./eventual-consistency";

import { kafka } from "./kafka";
import { urlShortener } from "./url-shortener";
import { bookingSystem } from "./booking-system";
import { paymentSystem } from "./payment-system";

import { architectureLightweight } from "./lightweight/architecture";
import { networkingLightweight } from "./lightweight/networking";
import { databasesLightweight } from "./lightweight/databases";
import { cachingLightweight } from "./lightweight/caching";
import { messagingLightweight } from "./lightweight/messaging";
import { distributedSystemsLightweight } from "./lightweight/distributed-systems";
import { reliabilityLightweight } from "./lightweight/reliability";
import { realWorldSystemsLightweight } from "./lightweight/real-world-systems";

export const deepDiveTopics: Topic[] = [
  loadBalancer,
  apiGateway,
  postgresqlIndexing,
  databaseTransactions,
  databaseLocking,
  databaseReplication,
  redis,
  cacheAside,
  cacheInvalidation,
  rateLimiting,
  distributedLocks,
  eventualConsistency,
];

export const semiDeepTopics: Topic[] = [kafka, urlShortener, bookingSystem, paymentSystem];

export const lightweightTopics: Topic[] = [
  ...architectureLightweight,
  ...networkingLightweight,
  ...databasesLightweight,
  ...cachingLightweight,
  ...messagingLightweight,
  ...distributedSystemsLightweight,
  ...reliabilityLightweight,
  ...realWorldSystemsLightweight,
];

export const topics: Topic[] = [...deepDiveTopics, ...semiDeepTopics, ...lightweightTopics];

const topicsById = new Map(topics.map((t) => [t.id, t]));

export function getTopicById(id: string): Topic | undefined {
  return topicsById.get(id);
}

export function getTopicsByCategory(categoryId: string): Topic[] {
  return topics.filter((t) => t.category === categoryId);
}

export function getRelatedTopics(topic: Topic): Topic[] {
  return (topic.relatedTopics ?? [])
    .map((id) => topicsById.get(id))
    .filter((t): t is Topic => Boolean(t));
}

export interface SearchResult {
  topic: Topic;
  score: number;
}

/**
 * Lightweight, dependency-free search over title / concepts / description.
 * Good enough for a few hundred topics; swap for a real search index
 * (e.g. Fuse.js or a hosted service) if the library grows much larger.
 */
export function searchTopics(query: string, limit = 8): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);

  const results: SearchResult[] = [];

  for (const topic of topics) {
    const title = topic.title.toLowerCase();
    const concepts = topic.concepts.map((c) => c.toLowerCase());
    const description = topic.description.toLowerCase();

    let score = 0;

    if (title === q) score += 100;
    else if (title.startsWith(q)) score += 60;
    else if (title.includes(q)) score += 35;

    for (const term of terms) {
      if (title.includes(term)) score += 12;
      if (concepts.some((c) => c.includes(term))) score += 8;
      if (description.includes(term)) score += 3;
    }

    if (score > 0) results.push({ topic, score });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function getPopularTopicIds(): string[] {
  return [
    "redis",
    "kafka",
    "postgresql",
    "cache-aside",
    "load-balancer",
    "database-sharding",
    "rate-limiting",
    "eventual-consistency",
  ];
}

export function getFeaturedSystemIds(): string[] {
  return [
    "url-shortener",
    "chat-system",
    "booking-system",
    "payment-system",
    "notification-system",
    "social-media-feed",
  ];
}
