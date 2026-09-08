import type { Topic } from "@/types/topic";

export const realWorldSystemsLightweight: Topic[] = [
  {
    id: "chat-system",
    title: "Chat System",
    category: "real-world-systems",
    difficulty: "intermediate",
    isDeepDive: false,
    description:
      "A chat system needs a persistent connection (WebSockets) for real-time delivery, a message store for history, and a fan-out mechanism to deliver a message to every member of a conversation, online or not.",
    concepts: ["WebSockets", "Message Fan-out", "Presence", "Offline Delivery"],
    relatedTopics: ["websockets", "message-queues", "notification-system"],
  },
  {
    id: "notification-system",
    title: "Notification System",
    category: "real-world-systems",
    difficulty: "intermediate",
    isDeepDive: false,
    description:
      "A notification system decouples 'something happened' from 'tell the user' — events are queued and fanned out to email, push, and in-app channels independently, so a slow channel never blocks the others.",
    concepts: ["Fan-out", "Message Queue", "Delivery Channels", "Retry"],
    relatedTopics: ["message-queues", "pub-sub", "sse", "retry"],
  },
  {
    id: "file-upload-system",
    title: "File Upload System",
    category: "real-world-systems",
    difficulty: "intermediate",
    isDeepDive: false,
    description:
      "Large file uploads typically go directly from the client to object storage using a pre-signed URL, rather than through the API server — keeping the API free of large request bodies.",
    concepts: ["Pre-signed URLs", "Object Storage", "Chunked Upload", "Virus Scanning"],
    relatedTopics: ["load-balancer", "message-queues"],
  },
  {
    id: "video-streaming",
    title: "Video Streaming",
    category: "real-world-systems",
    difficulty: "advanced",
    isDeepDive: false,
    description:
      "Video streaming systems transcode uploads into multiple resolutions, split them into small segments, and serve them from a CDN with adaptive bitrate switching based on the viewer's connection speed.",
    concepts: ["Transcoding", "Adaptive Bitrate", "CDN", "Segmenting"],
    relatedTopics: ["cdn", "file-upload-system"],
  },
  {
    id: "search-engine",
    title: "Search Engine",
    category: "real-world-systems",
    difficulty: "advanced",
    isDeepDive: false,
    description:
      "A search system builds an inverted index ahead of time — mapping terms to the documents containing them — so a query can find matches instantly instead of scanning every document.",
    concepts: ["Inverted Index", "Ranking", "Indexing Pipeline"],
    relatedTopics: ["postgresql-indexing", "event-driven-architecture"],
  },
  {
    id: "social-media-feed",
    title: "Social Media Feed",
    category: "real-world-systems",
    difficulty: "advanced",
    isDeepDive: false,
    description:
      "A feed system either computes each user's timeline on read (fan-out on read) or pre-computes it into every follower's feed on write (fan-out on write) — the classic tradeoff between read and write cost at scale.",
    concepts: ["Fan-out on Write", "Fan-out on Read", "Hot Users"],
    relatedTopics: ["cache-aside", "message-queues", "eventual-consistency"],
  },
  {
    id: "ride-booking",
    title: "Ride Booking",
    category: "real-world-systems",
    difficulty: "advanced",
    isDeepDive: false,
    description:
      "A ride-booking system matches riders to nearby drivers in real time using geospatial indexing, then coordinates state (requested → accepted → in-progress → completed) across both parties reliably.",
    concepts: ["Geospatial Indexing", "Real-time Matching", "State Machine"],
    relatedTopics: ["booking-system", "websockets", "distributed-locks"],
  },
  {
    id: "food-delivery",
    title: "Food Delivery",
    category: "real-world-systems",
    difficulty: "advanced",
    isDeepDive: false,
    description:
      "Food delivery systems coordinate three parties (customer, restaurant, courier) through a shared order state machine, with real-time location tracking and inventory checks against the restaurant's live menu.",
    concepts: ["Order State Machine", "Real-time Tracking", "Multi-party Coordination"],
    relatedTopics: ["ride-booking", "booking-system", "event-driven-architecture"],
  },
  {
    id: "job-queue",
    title: "Job Queue",
    category: "real-world-systems",
    difficulty: "intermediate",
    isDeepDive: false,
    description:
      "A job queue lets an API respond immediately while deferring slow work (sending emails, processing images) to background workers that pull jobs off a queue at their own pace.",
    concepts: ["Background Workers", "Retry", "Dead Letter Queue"],
    relatedTopics: ["message-queues", "dead-letter-queue", "distributed-locks"],
  },
  {
    id: "distributed-scheduler",
    title: "Distributed Scheduler",
    category: "real-world-systems",
    difficulty: "advanced",
    isDeepDive: false,
    description:
      "A distributed scheduler triggers jobs at specific times or intervals across a fleet of workers, using leader election or distributed locks to make sure a scheduled job runs exactly once, not once per worker.",
    concepts: ["Leader Election", "Distributed Locks", "Cron at Scale"],
    relatedTopics: ["distributed-locks", "leader-election", "job-queue"],
  },
];
