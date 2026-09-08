# Contributing to SystemAtlas

Thank you for considering a contribution. The best way to help right now is **adding or expanding a topic** — and
you can do that without understanding the React application at all.

## The core idea

Every topic page is rendered entirely from one `Topic` object, defined in [`src/types/topic.ts`](./src/types/topic.ts).
No section of the UI hard-codes content — it just reads whichever fields exist on the topic and renders them. If a
field is missing, that section simply doesn't appear on the page.

This means: **adding a topic = adding a data file.** You don't need to touch any component.

## Quick start: expanding a lightweight topic

Most concepts in the taxonomy already exist as lightweight stubs — a title, description, a few concepts, and related
topics — grouped by category in `src/data/topics/lightweight/*.ts`. To expand one into a full topic:

1. Find its entry (e.g. `circuit-breaker` in `src/data/topics/lightweight/reliability.ts`).
2. Move it into its own file in `src/data/topics/<topic-id>.ts` (copy the pattern from an existing deep-dive file
   like `src/data/topics/rate-limiting.ts`).
3. Fill in whichever sections make sense (see below — you don't need all of them).
4. Remove the old lightweight entry and register the new file in `src/data/topics/index.ts`:

```ts
import { circuitBreaker } from "./circuit-breaker";
// add it to deepDiveTopics or semiDeepTopics
```

## Adding a brand-new topic

Create `src/data/topics/<your-topic-id>.ts`:

```ts
import type { Topic } from "@/types/topic";

export const yourTopic: Topic = {
  id: "your-topic-id",           // used in the URL: /topic/your-topic-id
  title: "Your Topic",
  category: "caching",           // must match an id in src/data/categories.ts
  difficulty: "intermediate",    // "beginner" | "intermediate" | "advanced"
  isDeepDive: true,               // shows a "Lightweight entry" badge when false
  description: "One or two sentences. What it is, in plain language.",
  concepts: ["Concept A", "Concept B"],
  // ...optional sections below
};
```

Then register it in `src/data/topics/index.ts` (add the import and add it to `deepDiveTopics` or
`semiDeepTopics`).

## Writing style

Follow **What → Why → How → Trade-off**. Write like a senior engineer explaining something to a colleague over
coffee, not a textbook:

> ❌ "Redis is a powerful, distributed, in-memory data structure server..."
>
> ✅ "Redis keeps frequently accessed data in memory, so applications can retrieve it without querying the primary
> database every time."

Keep paragraphs short. Prefer concrete examples and numbers over abstract claims.

## Section-by-section guide

All of these are optional — include only what you can write well.

### `howItWorks: string[]`

3-5 short sentences, each becomes one numbered step in the Overview section. This is the plain-language explanation
that runs before any diagram.

### `architecture` + `edges` — the interactive diagram

This is the most important part of a topic. `architecture` is an array of `ArchitectureNode`:

```ts
architecture: [
  {
    id: "api",                 // referenced by edges, requestFlow, and implementations
    label: "API Server",
    role: "service",           // see NodeRole in types/topic.ts — drives the icon
    x: 300, y: 200,             // position on the canvas (pixels)
    summary: "One-line description shown before clicking.",
    detail: {                   // shown in the click-to-inspect side panel
      role: "Application server",
      why: "Why this component exists in the architecture.",
      input: "What comes in",
      output: "What goes out",
      operations: ["GET", "SET"],
      failure: "What happens if this component fails.",
      related: ["cache-aside", "ttl"], // other topic ids
    },
  },
],
edges: [
  { id: "e1", source: "client", target: "api", kind: "sync", label: "HTTPS" },
  // kind: "sync" (solid arrow) | "async" (animated dashed) | "optional" (dotted)
],
```

Available `role` values (each maps to an icon): `client`, `service`, `database`, `cache`, `queue`, `external`,
`loadbalancer`, `gateway`, `worker`, `storage`.

Positioning tip: lay nodes out left-to-right or top-to-bottom in the order a request would visit them, roughly
200-260px apart on `x`, 100-140px apart on `y`. The diagram auto-fits on load.

### `requestFlow` — "Follow a Request"

An ordered array of `RequestStep`. Each step's `nodeId` must match an id in `architecture` — the diagram highlights
that node when the step is active.

```ts
requestFlow: [
  {
    id: "s1",
    nodeId: "api",
    title: "Short step title",
    description: "One or two sentences of what happens here.",
    operation: "GET /users/123",   // optional, shown as inline code
    outcome: "200 OK",              // optional
    latencyMs: 15,                   // optional, shown as "illustrative latency"
  },
],
```

### `implementations` — real code

```ts
implementations: [
  {
    id: "example-1",
    filename: "user.service.ts",
    language: "TypeScript",
    description: "One sentence of context.",
    relatedNodes: ["api", "redis", "db"], // shown as a clickable "Used by:" chain
    code: `...`,
  },
],
```

Keep code realistic and runnable-looking — no pseudocode. `relatedNodes` connects the snippet back to the
architecture diagram; clicking a node name in the "Used by" row scrolls to and highlights that node.

### `database` — schema

```ts
database: {
  tables: [
    {
      name: "users",
      columns: [
        { name: "id", type: "bigint", isPrimaryKey: true },
        { name: "email", type: "text", isIndexed: true, note: "optional explanation" },
      ],
      exampleRows: [{ id: 1, email: "a@b.com" }],
      indexNote: {              // optional before/after visual, e.g. for indexing topics
        before: "sequential scan",
        after: "index scan",
        explanation: "Why this matters.",
      },
    },
  ],
},
```

### `tradeoffs`

```ts
tradeoffs: {
  advantages: ["...", "..."],
  disadvantages: ["...", "..."],
  whenToUse: "A concrete sentence about when this is (and isn't) the right choice.",
},
```

Avoid generic pros/cons — tie each point to a concrete consequence.

### `failureModes`

```ts
failureModes: [
  {
    id: "fm-1",
    title: "What breaks",
    scenario: "The specific situation that triggers it.",
    path: ["client", "api", "redis"], // labels/ids shown as a broken chain
    explanation: "What actually happens and why.",
    consequences: ["...", "..."],
  },
],
```

### `scaling`

An ordered array of `ScalingStage` — each stage is a mini before/after diagram (as a plain label chain) plus a
problem/solution/trade-off explanation. Focus on **why** the architecture changes at each stage, not just what it
looks like.

### `relatedTopics: string[]`

An array of other topic ids. These render as a small clickable knowledge graph at the bottom of the page. Only
reference ids that exist (or that you're also adding).

## Registering categories

If you're introducing a genuinely new category (rare), add it to `src/data/categories.ts` first.

## Before opening a PR

- `npm run build` should pass (type-checks + builds).
- Check your topic page in the browser — click through the diagram, step through the request flow, and confirm the
  "Used by" links in code blocks highlight the right node.
- Keep the tone consistent with existing topics — read a couple of the deep-dive files
  (`src/data/topics/redis.ts` is a good example) before writing your own.
