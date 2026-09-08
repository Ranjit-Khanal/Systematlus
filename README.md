# SystemAtlas

**A visual reference for backend engineering and system design.**

SystemAtlas is not a course, a quiz platform, or an infrastructure simulator. It's a place to search for a concept —
Redis, Kafka, database sharding, rate limiting — and immediately understand it through a concise explanation and an
interactive architecture diagram you can click through.

The core loop:

```
search → read → see diagram → click components → follow request → see real code → understand trade-offs → explore related topics
```

## Tech stack

- **React + TypeScript + Vite**
- **Tailwind CSS** for styling
- **React Flow** for interactive architecture diagrams
- **Framer Motion** for restrained UI motion
- **Zustand** for small bits of global UI state (theme, search modal)
- **React Router** for navigation

No backend, no database — the entire content library is static TypeScript data, bundled at build time.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL (typically `http://localhost:5173`).

Other scripts:

```bash
npm run build     # type-check and build for production
npm run preview   # preview the production build locally
npm run lint      # run oxlint
```

## How the app is structured

```
src/
├── types/topic.ts          # The Topic content model — the single source of truth for shape
├── data/
│   ├── categories.ts       # The 8 top-level categories
│   └── topics/
│       ├── <deep-dive>.ts  # One file per flagship, fully-detailed topic
│       ├── kafka.ts        # Semi-deep topics with rich architecture but no full scaling narrative
│       ├── url-shortener.ts, booking-system.ts, payment-system.ts
│       ├── lightweight/    # Lightweight topic stubs, grouped by category
│       └── index.ts        # Registry: aggregates every topic + search
├── components/
│   ├── architecture/       # React Flow diagram, custom node, node inspector
│   ├── requestFlow/        # Manual + animated "follow a request" stepper
│   ├── code/                # Syntax-highlighted code blocks with diagram linkage
│   ├── database/            # Schema viewer
│   ├── tradeoffs/, failureModes/, scaling/, related/
│   ├── search/              # Command palette (⌘K) + homepage hero search
│   ├── layout/               # Header, page shell, topic sidebar/section wrappers
│   └── ui/                   # Small shadcn-style primitives (Button, Badge, Card, Dialog, Sheet)
├── pages/                    # Route-level pages (Home, Explore, Topics, Systems, Concepts, About, TopicPage)
├── store/useUIStore.ts        # Zustand store: theme + search modal state
└── lib/                       # cn() class helper, the custom syntax highlighter
```

**The most important idea in this codebase:** UI components never hard-code topic content. Every topic page section
(architecture, request flow, code, database, trade-offs, failure modes, scaling, related topics) reads from a
`Topic` object. Adding a new topic means creating a new data file — not touching any component.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for a full walkthrough of adding a topic.

## Content status

12 topics are built out in full depth (architecture, request flow, implementation code, trade-offs, failure modes,
and a scaling narrative): Load Balancer, API Gateway, PostgreSQL Indexing, Database Transactions, Database Locking,
Database Replication, Redis, Cache-Aside, Cache Invalidation, Rate Limiting, Distributed Locks, and Eventual
Consistency.

Kafka, URL Shortener, Booking System, and Payment System have rich architecture diagrams and code but a lighter
scaling section. Every other concept in the taxonomy exists as a lightweight entry (description + concepts +
related topics) ready to be expanded — see CONTRIBUTING.md for how.

## License

MIT — see [LICENSE](./LICENSE).
