import Link from "next/link";

export const metadata = {
  title: "Privacy Policy - AI Influencer Dashboard",
  description: "Privacy Policy for AI Influencer Dashboard",
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-2xl space-y-8 rounded-lg border bg-card p-8 shadow-lg sm:p-10">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">
            AI Influencer Dashboard &mdash; operated by{" "}
            <a
              href="https://ceed.cloud"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Ceed
            </a>
          </p>
          <p className="text-sm text-muted-foreground">
            Effective Date: March 3, 2026
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            1. Data We Collect
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            When you authorize this application via Google OAuth 2.0, we collect
            and store only the following:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>
              <strong className="text-foreground">YouTube OAuth tokens</strong>{" "}
              (refresh token and access token) to maintain authorized access to
              your YouTube channel.
            </li>
            <li>
              <strong className="text-foreground">YouTube channel ID</strong> to
              identify which channel to upload to.
            </li>
            <li>
              <strong className="text-foreground">YouTube channel analytics data</strong>{" "}
              (views, watch time, likes, comments, shares, and engagement
              metrics) accessed via the YouTube Analytics API v2 to measure
              content performance.
            </li>
          </ul>
          <p className="leading-relaxed text-muted-foreground">
            We do <strong className="text-foreground">not</strong> collect your
            video viewing history, personal information, contacts, or any YouTube
            data beyond what is required for video uploading and performance
            measurement.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            2. How We Use Your Data
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            Your OAuth tokens are used for the following purposes:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>
              <strong className="text-foreground">Video uploading</strong> —
              uploading videos to your authorized YouTube channel via the YouTube
              Data API v3.
            </li>
            <li>
              <strong className="text-foreground">Performance measurement</strong> —
              retrieving channel analytics (views, watch time, engagement) via
              the YouTube Analytics API v2 to optimize content strategy.
            </li>
          </ul>
          <p className="leading-relaxed text-muted-foreground">
            This is an internal content management tool; all operations are
            initiated by authorized platform operators only.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            3. Data Sharing
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            We do <strong className="text-foreground">not</strong> share, sell,
            or transfer your data to any third parties. Your OAuth tokens and
            channel information are used exclusively within this application.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            4. Data Storage &amp; Security
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            Your OAuth tokens are stored securely in a PostgreSQL database
            hosted on Google Cloud SQL with encryption at rest. Access to the
            database is restricted to authorized application services only.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            5. Data Retention &amp; Deletion
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            Your data is retained only as long as your YouTube channel is active
            within our platform. You may request deletion of your data at any
            time by contacting us. Upon request, we will revoke stored OAuth
            tokens and remove all associated data from our systems.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            6. Revoking Access
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            You can revoke this application&apos;s access to your YouTube account
            at any time through your{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Google Account permissions
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            7. Google API Services
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            AI Influencer Dashboard&apos;s use and transfer to any other app of
            information received from Google APIs will adhere to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Google API Services User Data Policy
            </a>
            , including the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Limited Use requirements
            </a>
            .
          </p>
          <p className="leading-relaxed text-muted-foreground">
            By using this application, you also agree to the following:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>
              <a
                href="https://www.youtube.com/t/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                YouTube Terms of Service
              </a>
            </li>
            <li>
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Google Privacy Policy
              </a>
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            8. Contact Us
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            If you have questions about this privacy policy or wish to request
            data deletion, please contact us at{" "}
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
          <Link href="/about" className="text-primary hover:underline text-sm">
            About this application
          </Link>
        </div>
      </div>
    </div>
  );
}
