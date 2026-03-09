import Link from "next/link";

export const metadata = {
  title: "About - AI Influencer Dashboard",
  description: "AI-powered multi-agent content automation platform for YouTube, TikTok, Instagram, and X",
};

export default function AboutPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-2xl space-y-8 rounded-lg border bg-card p-4 shadow-lg sm:p-10">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            AI Influencer Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">v5.0 &mdash; operated by{" "}
            <a
              href="https://ceed.cloud"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Ceed
            </a>
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            What is AI Influencer Dashboard?
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            AI Influencer Dashboard is an internal, operator-only content management
            system that autonomously creates, schedules, publishes, and measures
            social media content across four platforms: YouTube, TikTok, Instagram,
            and X (Twitter). It is built on a multi-agent AI architecture and is
            operated exclusively by authorized staff at Ceed. It is not a public
            tool and does not accept sign-ups from external users.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            Supported Platforms
          </h2>
          <p className="font-semibold text-foreground">YouTube</p>
          <p className="leading-relaxed text-muted-foreground">
            Videos are uploaded to authorized YouTube channels via the YouTube Data
            API v3 using resumable upload. Channel performance metrics — views,
            watch time, likes, comments, shares, and engagement rate — are collected
            via the YouTube Analytics API v2 to drive content optimization.
          </p>
          <p className="font-semibold text-foreground mt-2">TikTok</p>
          <p className="leading-relaxed text-muted-foreground">
            Videos are published to authorized TikTok accounts via the TikTok
            Content Posting API v2 using a three-step flow: initialize, upload,
            and poll for completion. Per-video metrics (views, likes, comments,
            shares) are retrieved via the TikTok Video Query API.
          </p>
          <p className="font-semibold text-foreground mt-2">Instagram</p>
          <p className="leading-relaxed text-muted-foreground">
            Reels are published to authorized Instagram Business accounts via the
            Instagram Graph API v21.0 using a container-create, poll, and publish
            flow. Reach, impressions, likes, comments, shares, and saves are
            collected via the Insights endpoint. Access is maintained using
            long-lived tokens refreshed approximately every 60 days.
          </p>
          <p className="font-semibold text-foreground mt-2">X (Twitter)</p>
          <p className="leading-relaxed text-muted-foreground">
            Posts are published to authorized X accounts via the X API v2 using
            OAuth 1.0a HMAC-SHA1 request signing. Per-tweet metrics (impressions,
            likes, retweets, replies, bookmarks) are retrieved via the X Tweet
            lookup endpoint.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            How It Works
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            The system operates as a continuous loop driven by a team of
            specialized AI agents:
          </p>
          <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
            <li>
              <strong className="text-foreground">Research</strong> — a Researcher
              agent monitors trends, analyzes competitor content, and identifies
              high-potential topics for each platform.
            </li>
            <li>
              <strong className="text-foreground">Content Production</strong> — a
              Producer agent generates scripts, synthesizes AI voiceover, and
              assembles video content automatically.
            </li>
            <li>
              <strong className="text-foreground">Review &amp; Approval</strong> —
              produced content enters a review queue where operators can approve,
              reject, or request revisions before publishing.
            </li>
            <li>
              <strong className="text-foreground">Publishing</strong> — an
              Orchestrator agent schedules and publishes approved content to the
              appropriate platform accounts at the optimal time.
            </li>
            <li>
              <strong className="text-foreground">Measurement</strong> — a Metrics
              agent collects post-publish performance data from each platform API
              and stores it for analysis.
            </li>
            <li>
              <strong className="text-foreground">Analysis &amp; Optimization</strong> —
              an Analyst agent synthesizes performance data into strategy
              recommendations that feed back into the research and production
              phases.
            </li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            Key Features
          </h2>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              <strong className="text-foreground">Automated video production</strong> —
              AI-generated scripts, AI voice synthesis, and automated
              video assembly with no manual editing required.
            </li>
            <li>
              <strong className="text-foreground">Multi-platform publishing</strong> —
              simultaneous or independently scheduled publishing to YouTube, TikTok,
              Instagram, and X from a single workflow.
            </li>
            <li>
              <strong className="text-foreground">Performance measurement</strong> —
              per-post and per-channel analytics (views, likes, comments, shares,
              engagement rate) collected automatically after publish.
            </li>
            <li>
              <strong className="text-foreground">OAuth token management</strong> —
              automatic refresh of expiring access tokens for all four platforms;
              operators are alerted before tokens become invalid.
            </li>
            <li>
              <strong className="text-foreground">AI content strategy</strong> —
              continuous feedback loop between measured performance and future
              content decisions, optimizing topics, formats, and posting cadence.
            </li>
            <li>
              <strong className="text-foreground">Operator dashboard</strong> —
              real-time visibility into account status, content queues, publishing
              history, and performance metrics across all managed accounts.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            Technology Stack
          </h2>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>
              <strong className="text-foreground">Dashboard</strong> — Next.js 14,
              Shadcn/ui, Tailwind CSS, Recharts
            </li>
            <li>
              <strong className="text-foreground">Agent layer</strong> — Multi-agent
              AI graphs (Researcher, Producer, Orchestrator, Analyst)
            </li>
            <li>
              <strong className="text-foreground">Tool layer</strong> — Internal
              API server with comprehensive platform integration tooling
            </li>
            <li>
              <strong className="text-foreground">Database</strong> — PostgreSQL
              hosted on Google Cloud SQL
            </li>
            <li>
              <strong className="text-foreground">Auth</strong> — NextAuth.js v4,
              Google OAuth with email whitelist and role-based access control
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            Operator Authorization
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            This application is restricted to authorized operators employed by or
            contracted with Ceed. Platform accounts (YouTube, TikTok, Instagram,
            X) are connected only by authorized operators through explicit OAuth
            consent flows. No external users can access or connect accounts. All
            content published through this system is initiated by authorized
            operators and subject to internal review and approval processes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">Contact</h2>
          <p className="leading-relaxed text-muted-foreground">
            For questions or concerns about this application, please contact us at{" "}
            <a
              href="mailto:pochi@0xqube.xyz"
              className="text-primary hover:underline"
            >
              pochi@0xqube.xyz
            </a>
            .
          </p>
        </section>

        <div className="border-t pt-6 flex gap-4">
          <Link href="/privacy" className="text-primary hover:underline text-sm">
            Privacy Policy
          </Link>
          <Link href="/terms" className="text-primary hover:underline text-sm">
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
