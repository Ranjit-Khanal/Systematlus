import { GithubMark } from "@/components/icons/GithubMark";

export function About() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">About SystemAtlas</h1>

      <div className="mt-6 space-y-4 text-sm leading-relaxed text-foreground">
        <p>
          SystemAtlas is a visual reference for backend engineering and system design. It's not a course, not a quiz
          platform, and not a simulator — it's a place to search for a concept, see it explained concisely, and
          explore an interactive architecture diagram until it clicks.
        </p>
        <p>The core loop is simple:</p>
        <div className="rounded-lg border border-border bg-panel px-5 py-4 font-mono text-xs leading-loose text-muted-foreground">
          search → read → see diagram → click components → follow request → see real code → understand trade-offs →
          explore related topics
        </div>
        <p>
          Every topic follows the same structure: a short explanation, an interactive React Flow diagram you can
          click through, a manual request-flow walkthrough, real implementation code, and an honest trade-offs
          section. No gamification, no badges, no walls of text.
        </p>
        <p>
          SystemAtlas is open source and built to be extended. Every topic is a plain TypeScript data file — adding
          one doesn't require touching any UI code. See the README and CONTRIBUTING guide in the repository for
          details.
        </p>
      </div>

      <a
        href="https://github.com"
        target="_blank"
        rel="noreferrer"
        className="mt-8 inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
      >
        <GithubMark size={16} /> View on GitHub
      </a>
    </div>
  );
}
