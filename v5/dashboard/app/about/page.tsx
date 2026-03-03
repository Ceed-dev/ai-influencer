import Link from "next/link";

export const metadata = {
  title: "About - AI Influencer Dashboard",
  description: "AI-powered content automation platform for YouTube, X, Instagram, and TikTok",
};

export default function AboutPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-2xl space-y-8 rounded-lg border bg-card p-8 shadow-lg sm:p-10">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            AI Influencer Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Operated by{" "}
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
            What is this application?
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            AI Influencer Dashboard is an internal content automation platform
            that manages AI-generated video production and publishing workflows.
            It automates the process of creating, reviewing, and uploading video
            content to YouTube, X (Twitter), Instagram, and TikTok channels on
            behalf of authorized users.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            Platform API Usage
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            This application uses the following platform APIs:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>
              <strong className="text-foreground">YouTube Data API v3</strong> —
              to upload videos to authorized YouTube channels.
            </li>
            <li>
              <strong className="text-foreground">YouTube Analytics API v2</strong> —
              to retrieve channel performance metrics (views, watch time,
              engagement) for content optimization.
            </li>
            <li>
              <strong className="text-foreground">TikTok Content Posting API</strong> —
              to publish videos to authorized TikTok accounts.
            </li>
            <li>
              <strong className="text-foreground">Instagram Graph API</strong> —
              to publish Reels to authorized Instagram accounts.
            </li>
            <li>
              <strong className="text-foreground">X (Twitter) API v2</strong> —
              to publish video posts to authorized X accounts.
            </li>
          </ul>
          <p className="leading-relaxed text-muted-foreground">
            Access is granted only through explicit OAuth consent by each
            account owner. The application does not access any data beyond the
            scopes authorized by the user.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">Contact</h2>
          <p className="text-muted-foreground">
            For questions or concerns, please contact us at{" "}
            <a
              href="mailto:pochi@0xqube.xyz"
              className="text-primary hover:underline"
            >
              pochi@0xqube.xyz
            </a>
            .
          </p>
        </section>

        <div className="border-t pt-6">
          <Link href="/privacy" className="text-primary hover:underline text-sm">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
