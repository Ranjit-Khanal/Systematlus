import type { Topic } from "@/types/topic";

export const paymentSystem: Topic = {
  id: "payment-system",
  title: "Payment System",
  category: "real-world-systems",
  difficulty: "advanced",
  isDeepDive: false,
  description:
    "A payment system must handle money moving through an unreliable network — which means every request has to survive retries, timeouts, and out-of-order confirmations without charging anyone twice.",
  concepts: ["Idempotency", "Webhooks", "Payment States", "Retries", "Duplicate Requests"],
  howItWorks: [
    "The client sends a payment request with a unique idempotency key generated once per checkout attempt.",
    "The Payment API forwards the charge to an external Payment Provider (Stripe, Adyen, etc.) and records the payment as 'pending'.",
    "The provider processes the charge asynchronously and calls back via a webhook once it succeeds or fails — the API can't just wait synchronously, since card networks can take seconds to minutes.",
    "If the client's original request times out and retries, the idempotency key ensures the same charge isn't created twice — the API returns the original result instead of charging again.",
  ],
  architecture: [
    { id: "client", label: "Client", role: "client", x: 20, y: 220 },
    { id: "api", label: "Payment API", role: "service", x: 260, y: 220, summary: "Validates and records the payment attempt.",
      detail: {
        role: "Payment orchestrator",
        why: "Owns idempotency and state tracking so retries and network failures never cause a duplicate charge.",
        input: "POST /payments { idempotencyKey, amount }",
        output: "Payment record in 'pending' state",
        operations: ["check idempotency key", "create payment intent", "record state"],
        related: ["idempotency", "database-transactions"],
      },
    },
    { id: "idem", label: "Idempotency Store", role: "cache", x: 260, y: 40, summary: "Maps idempotency key → prior result." },
    { id: "provider", label: "Payment Provider", role: "external", x: 540, y: 220, summary: "External processor (e.g. Stripe)." },
    { id: "webhook", label: "Webhook Handler", role: "service", x: 800, y: 100, summary: "Receives async confirmation.",
      detail: {
        role: "Async callback receiver",
        why: "Card processing is asynchronous — the provider tells us the outcome later, not in the original response.",
        input: "POST /webhooks/payment { paymentId, status }",
        output: "Updated payment state",
        failure: "Webhooks can arrive more than once — the handler must be idempotent too.",
        related: ["retry", "idempotency"],
      },
    },
    { id: "db", label: "PostgreSQL", role: "database", x: 800, y: 340, summary: "Source of truth for payment state." },
  ],
  edges: [
    { id: "e1", source: "client", target: "api", kind: "sync" },
    { id: "e2", source: "api", target: "idem", kind: "sync", label: "check key" },
    { id: "e3", source: "api", target: "provider", kind: "sync", label: "charge" },
    { id: "e4", source: "provider", target: "webhook", kind: "async", label: "payment.succeeded" },
    { id: "e5", source: "webhook", target: "db", kind: "sync", label: "update state" },
    { id: "e6", source: "api", target: "db", kind: "sync", label: "record pending" },
  ],
  requestFlow: [
    { id: "s1", nodeId: "client", title: "Client submits payment", description: "The checkout page sends a charge request with a unique idempotency key generated when the user clicked 'Pay'.", operation: "POST /payments { idempotencyKey: 'chk_9f2a', amount: 4999 }" },
    { id: "s2", nodeId: "idem", title: "API checks for a duplicate", description: "The API checks whether this idempotency key has been seen before — protecting against the client retrying after a timeout.", outcome: "not seen before" },
    { id: "s3", nodeId: "provider", title: "Charge is sent to the provider", description: "The API calls the external payment provider and records the payment as pending.", operation: "provider.charge(amount, card)", outcome: "pending" },
    { id: "s4", nodeId: "webhook", title: "Provider confirms asynchronously", description: "Seconds later, the provider calls the webhook endpoint to report the final outcome.", operation: "payment.succeeded", latencyMs: 1200 },
    { id: "s5", nodeId: "db", title: "Payment state is finalized", description: "The webhook handler updates the payment record from 'pending' to 'succeeded', which the client can now see.", outcome: "succeeded" },
  ],
  implementations: [
    {
      id: "idempotent-charge",
      filename: "payments.service.ts",
      language: "TypeScript",
      description: "The idempotency key is the core defense against duplicate charges from retried requests.",
      relatedNodes: ["api", "idem", "provider", "db"],
      code: `async function createPayment(idempotencyKey: string, amount: number, card: Card) {
  const existing = await db.payments.findByIdempotencyKey(idempotencyKey);
  if (existing) return existing; // return the original result, don't recharge

  const payment = await db.payments.create({
    idempotencyKey,
    amount,
    status: "pending",
  });

  const intent = await provider.charge({ amount, card, idempotencyKey });

  await db.payments.update(payment.id, { providerRef: intent.id });
  return payment;
}`,
    },
    {
      id: "webhook-handler",
      filename: "webhook.route.ts",
      language: "TypeScript",
      description: "Webhooks can be delivered more than once (the provider retries on timeout) — updates must be idempotent.",
      relatedNodes: ["webhook", "db"],
      code: `app.post("/webhooks/payment", async (req, res) => {
  const event = verifyWebhookSignature(req);

  const payment = await db.payments.findByProviderRef(event.paymentIntentId);
  if (!payment || payment.status === "succeeded") {
    // Already processed — safe to acknowledge and stop here.
    return res.sendStatus(200);
  }

  await db.payments.update(payment.id, { status: event.type });
  res.sendStatus(200);
});`,
    },
  ],
  database: {
    tables: [
      {
        name: "payments",
        columns: [
          { name: "id", type: "bigint", isPrimaryKey: true },
          { name: "idempotency_key", type: "text", isIndexed: true, note: "unique — enforced at the DB level too" },
          { name: "amount", type: "int", note: "in cents" },
          { name: "status", type: "text", note: "'pending' | 'succeeded' | 'failed'" },
          { name: "provider_ref", type: "text" },
        ],
        exampleRows: [{ id: 91, idempotency_key: "chk_9f2a", amount: 4999, status: "succeeded", provider_ref: "pi_1AbC" }],
      },
    ],
  },
  tradeoffs: {
    advantages: [
      "Idempotency keys make retries safe by default, even across network failures",
      "Webhooks decouple the API from slow, variable-latency card processing",
      "A clear state machine (pending → succeeded/failed) makes reconciliation straightforward",
    ],
    disadvantages: [
      "Meaningfully more moving parts than a synchronous 'charge and respond' call",
      "Webhook delivery isn't instant or guaranteed exactly-once — handlers must tolerate duplicates and delay",
      "Reconciling state when a webhook is lost entirely requires a periodic polling fallback",
    ],
    whenToUse:
      "This pattern is close to mandatory for any real payment integration — card networks are inherently asynchronous and unreliable, and the cost of a duplicate charge is high enough to justify the extra complexity.",
  },
  failureModes: [
    {
      id: "duplicate-request",
      title: "Client retries after a timeout",
      scenario: "The client's request to /payments times out (but the API actually processed it), so the client retries.",
      path: ["client", "api", "idem"],
      explanation: "Without an idempotency key, this would create a second charge. With one, the API recognizes the key and returns the original result instead of charging again.",
      consequences: ["Correct behavior: exactly one charge despite two requests", "This is the entire reason idempotency keys exist"],
    },
    {
      id: "duplicate-webhook",
      title: "Webhook delivered twice",
      scenario: "The payment provider doesn't receive a fast enough 200 OK and retries the webhook.",
      path: ["provider", "webhook", "db"],
      explanation: "The handler checks the current payment status first — if it's already 'succeeded', it acknowledges the webhook without reapplying the update.",
      consequences: ["No duplicate downstream effects (like sending two receipt emails)", "Requires the webhook handler itself to be idempotent, not just the charge"],
    },
    {
      id: "lost-webhook",
      title: "A webhook never arrives",
      scenario: "Network issues or a bug prevent a webhook from being delivered at all.",
      path: ["provider", "webhook"],
      explanation: "The payment can get stuck in 'pending' indefinitely if the API relies solely on webhooks.",
      consequences: ["Stuck payment state", "Mitigated with a periodic reconciliation job that polls the provider for any pending payment older than a few minutes"],
    },
  ],
  scaling: [
    {
      id: "stage1",
      title: "Synchronous charge, no idempotency",
      description: "Call the provider and wait for a direct response.",
      nodes: ["Client", "Payment API", "Provider"],
      problem: "A retried request after a timeout can create a duplicate charge.",
    },
    {
      id: "stage2",
      title: "Add idempotency keys",
      description: "Require a client-generated key on every payment attempt.",
      nodes: ["Client", "Payment API", "Idempotency Store", "Provider"],
      solution: "Retries are safe — the same key always returns the same result.",
      tradeoff: "Clients must correctly generate and persist keys across retries.",
    },
    {
      id: "stage3",
      title: "Webhooks + reconciliation",
      description: "Move to async confirmation via webhooks, with a polling job as a safety net for lost webhooks.",
      nodes: ["Payment API", "Provider", "Webhook Handler", "Reconciliation Job"],
      problem: "Synchronous waiting doesn't fit real card processing latency, and webhooks alone aren't 100% reliable.",
      solution: "Combine push (webhooks) with a pull-based safety net (reconciliation).",
      tradeoff: "The most robust option, but the most infrastructure to build and monitor.",
    },
  ],
  relatedTopics: ["idempotency", "retry", "booking-system", "event-driven-architecture"],
};
