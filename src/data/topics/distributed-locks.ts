import type { Topic } from "@/types/topic";

export const distributedLocks: Topic = {
  id: "distributed-locks",
  title: "Distributed Locks",
  category: "distributed-systems",
  difficulty: "advanced",
  isDeepDive: true,
  description:
    "A distributed lock lets multiple independent processes agree that only one of them may do something at a time — even though none of them share memory or a single database transaction.",
  concepts: ["Mutual Exclusion", "Redlock", "Lease/TTL", "Fencing Token", "Split Brain"],
  howItWorks: [
    "Unlike a database row lock (which only works within one database), a distributed lock coordinates across separate processes, often separate services entirely.",
    "The most common implementation uses a shared store like Redis: a process acquires the lock by writing a unique key only if it doesn't already exist (SET NX), then releases it by deleting that key when done.",
    "Because a process can crash while holding a lock, every distributed lock needs a TTL — an automatic expiry — so the lock isn't held forever.",
    "The TTL introduces a subtle danger: if a process is paused (e.g. a long GC pause) past the TTL, another process can acquire the lock while the first still thinks it holds it. Fencing tokens (an incrementing number attached to the lock) let downstream systems reject stale holders.",
  ],
  architecture: [
    { id: "worker1", label: "Worker 1", role: "worker", x: 20, y: 80 },
    { id: "worker2", label: "Worker 2", role: "worker", x: 20, y: 300 },
    { id: "redis", label: "Redis", role: "cache", x: 340, y: 190, summary: "Holds the lock key with a TTL.",
      detail: {
        role: "Lock coordinator",
        why: "Provides a single shared place both workers can atomically check-and-set, which neither could do safely on their own.",
        input: "SET lock:job42 <token> NX PX 5000",
        output: "Lock acquired (or rejected if already held)",
        operations: ["SET NX PX", "DEL (release)", "compare-and-delete via Lua"],
        failure: "If Redis itself fails, no one can acquire or release locks — this is a critical dependency and often run as a small dedicated cluster.",
        related: ["redis", "database-locking"],
      },
    },
    { id: "resource", label: "Shared Resource", role: "storage", x: 660, y: 190, summary: "The thing being protected (e.g. a job, a file, an external API)." },
  ],
  edges: [
    { id: "e1", source: "worker1", target: "redis", kind: "sync", label: "acquire lock" },
    { id: "e2", source: "worker2", target: "redis", kind: "sync", label: "acquire lock (blocked)" },
    { id: "e3", source: "worker1", target: "resource", kind: "sync", label: "process job" },
  ],
  requestFlow: [
    { id: "s1", nodeId: "worker1", title: "Worker 1 tries to acquire the lock", description: "Two workers both wake up to process the same scheduled job.", operation: "SET lock:job42 token-a NX PX 5000" },
    { id: "s2", nodeId: "redis", title: "Lock is granted to Worker 1", description: "Since the key didn't exist, Redis creates it and returns success — with a 5 second auto-expiry.", outcome: "OK" },
    { id: "s3", nodeId: "worker2", title: "Worker 2's attempt is rejected", description: "The key already exists, so Redis returns nil — Worker 2 backs off and does not process the job.", operation: "SET lock:job42 token-b NX PX 5000", outcome: "nil (already locked)" },
    { id: "s4", nodeId: "resource", title: "Worker 1 processes the job alone", description: "Only Worker 1 does the actual work, avoiding duplicate processing." },
    { id: "s5", nodeId: "redis", title: "Worker 1 releases the lock", description: "Worker 1 deletes the key — but only after verifying it still owns it (comparing its token), to avoid releasing a lock it no longer owns.", operation: "compare-and-delete(token-a)" },
  ],
  implementations: [
    {
      id: "acquire-release",
      filename: "distributedLock.ts",
      language: "TypeScript",
      description: "Acquire with a unique token, release only if you still own the lock.",
      relatedNodes: ["worker1", "redis"],
      code: `const token = crypto.randomUUID();

async function withLock<T>(resource: string, ttlMs: number, fn: () => Promise<T>) {
  const acquired = await redis.set(\`lock:\${resource}\`, token, { NX: true, PX: ttlMs });
  if (!acquired) throw new Error("Could not acquire lock");

  try {
    return await fn();
  } finally {
    // Only delete if the value is still our token —
    // otherwise we might delete a lock someone else now owns.
    await redis.eval(
      \`if redis.call("get", KEYS[1]) == ARGV[1] then
         return redis.call("del", KEYS[1])
       else return 0 end\`,
      { keys: [\`lock:\${resource}\`], arguments: [token] },
    );
  }
}`,
    },
    {
      id: "fencing-token",
      filename: "fencing.ts",
      language: "TypeScript",
      description: "A fencing token protects the downstream resource even if a lock holder is mistaken about still owning the lock.",
      relatedNodes: ["resource"],
      code: `// Each successful lock acquisition increments a monotonic counter.
const fencingToken = await redis.incr("lock:job42:fencing");

// The downstream resource rejects any write with a token
// lower than the highest one it has already seen.
await storage.write(data, { fencingToken });
// storage.write internally: if (fencingToken < lastSeenToken) reject();`,
    },
  ],
  tradeoffs: {
    advantages: [
      "Prevents duplicate processing across independent, horizontally-scaled workers",
      "Simple to implement for the common case with Redis's SET NX PX",
      "Fencing tokens close the gap left by TTL expiry during a paused/slow holder",
    ],
    disadvantages: [
      "A single Redis instance is a single point of failure for the lock itself",
      "TTL is a guess — too short risks releasing while still working; too long risks a stuck lock after a crash",
      "True correctness under network partitions (Redlock's guarantees) is a genuinely debated, subtle topic",
    ],
    whenToUse:
      "Use a distributed lock when multiple independent processes (not threads in one process, not rows in one database) must not do the same thing simultaneously — e.g. only one instance of a scheduled job should run, or only one worker should process a given queue item.",
  },
  failureModes: [
    {
      id: "stale-holder",
      title: "Lock expires while the holder still thinks it owns it",
      scenario: "Worker 1 pauses for 6 seconds (e.g. GC pause) while holding a lock with a 5 second TTL.",
      path: ["worker1", "redis", "worker2"],
      explanation: "The lock auto-expires and Worker 2 acquires it and starts processing — now two workers can be working on the same resource simultaneously.",
      consequences: ["Duplicate processing", "Mitigated with fencing tokens so the downstream resource can reject the stale worker's late writes"],
    },
    {
      id: "redis-spof",
      title: "The lock store itself fails",
      scenario: "The single Redis instance holding locks goes down.",
      path: ["worker1", "redis"],
      explanation: "No process can acquire or release locks. Depending on design, this either blocks all coordinated work or (worse) causes every worker to assume no lock exists and proceed simultaneously.",
      consequences: ["Either a full processing halt, or a loss of mutual exclusion guarantees", "Production systems often run Redis in a replicated/sentinel setup for this reason"],
    },
  ],
  scaling: [
    {
      id: "stage1",
      title: "Single worker",
      description: "One process handles all scheduled jobs — no locking needed.",
      nodes: ["Worker", "Job Queue"],
      problem: "A single worker can't scale and is a single point of failure.",
    },
    {
      id: "stage2",
      title: "Multiple workers + distributed lock",
      description: "Scale out to N workers, using a Redis lock to ensure only one processes a given job.",
      nodes: ["Worker × N", "Redis lock", "Job Queue"],
      solution: "Horizontal scaling without duplicate processing.",
      tradeoff: "Redis becomes a critical shared dependency.",
    },
    {
      id: "stage3",
      title: "Consensus-based locking",
      description: "For very high correctness requirements, move to a consensus system (etcd, ZooKeeper) built specifically for distributed coordination.",
      nodes: ["Worker × N", "etcd/ZooKeeper cluster", "Job Queue"],
      problem: "A single Redis node's failure modes aren't rigorous enough for critical coordination.",
      solution: "Use a system designed around a consensus protocol (Raft) for stronger guarantees.",
      tradeoff: "Higher operational complexity than a single Redis instance.",
    },
  ],
  relatedTopics: ["database-locking", "redis", "leader-election", "idempotency"],
};
