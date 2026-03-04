import Link from "next/link";

export const metadata = {
  title: "Terms of Service - AI Influencer Dashboard",
  description: "Terms of Service for AI Influencer Dashboard",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-2xl space-y-8 rounded-lg border bg-card p-8 shadow-lg sm:p-10">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
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
            Effective Date: March 4, 2026
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            1. Acceptance of Terms
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            By authorizing this application or using any of its features, you
            agree to be bound by these Terms of Service. If you do not agree,
            do not authorize or use this application.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            2. Description of Service
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            AI Influencer Dashboard is an internal content automation platform
            that manages AI-generated video production and publishing workflows
            across multiple social media platforms including YouTube, TikTok,
            Instagram, and X (Twitter). The platform automates content creation,
            scheduling, posting, and performance measurement on behalf of
            authorized account owners.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            3. Authorized Use
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            This application is an internal tool operated by Ceed. Access is
            restricted to authorized operators only. You agree to:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>Use this application only for lawful content creation and publishing purposes.</li>
            <li>Not use this application to post content that violates any platform&apos;s community guidelines or terms of service.</li>
            <li>Not use this application to post spam, misinformation, or content that infringes third-party rights.</li>
            <li>Maintain the confidentiality of any credentials or access tokens associated with your accounts.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            4. TikTok Platform Integration
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            This application integrates with the TikTok Content Posting API and
            TikTok Video Query API. By authorizing your TikTok account, you
            acknowledge and agree to the following:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>
              You expressly consent to this application posting video content to
              your TikTok account on your behalf. Posting will only occur for
              content you have approved.
            </li>
            <li>
              This application will access your TikTok video metrics (views,
              likes, comments, shares) solely for content performance measurement.
            </li>
            <li>
              Your TikTok OAuth credentials (access token and refresh token) are
              stored securely and used only for the purposes described in our{" "}
              <Link href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              .
            </li>
            <li>
              All content posted via this application must comply with the{" "}
              <a
                href="https://www.tiktok.com/legal/page/global/terms-of-service/en"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                TikTok Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="https://www.tiktok.com/community-guidelines"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                TikTok Community Guidelines
              </a>
              .
            </li>
            <li>
              You may revoke TikTok access at any time through your TikTok
              account settings or by contacting us.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            5. YouTube Platform Integration
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            This application integrates with the YouTube Data API v3 and YouTube
            Analytics API v2. By authorizing your YouTube account, you agree that:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>
              You expressly consent to this application uploading video content to
              your YouTube channel on your behalf.
            </li>
            <li>
              All content posted must comply with the{" "}
              <a
                href="https://www.youtube.com/t/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                YouTube Terms of Service
              </a>
              .
            </li>
            <li>
              This application&apos;s use of Google API data adheres to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Google API Services User Data Policy
              </a>
              .
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            6. Content Responsibility
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            You are solely responsible for any content posted to your accounts
            through this application. Ceed is not responsible for content that
            violates platform policies or applicable laws. You agree to indemnify
            Ceed against any claims arising from content posted through your
            authorized accounts.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            7. Limitation of Liability
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            This application is provided &quot;as is&quot; without warranties of
            any kind. Ceed shall not be liable for any indirect, incidental, or
            consequential damages arising from the use of this application,
            including but not limited to account suspension by third-party
            platforms, loss of data, or interruption of service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            8. Modifications
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            Ceed reserves the right to update these Terms of Service at any time.
            Continued use of this application after changes constitutes acceptance
            of the updated terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            9. Contact Us
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            For questions about these Terms of Service, please contact us at{" "}
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
          <Link href="/about" className="text-primary hover:underline text-sm">
            About
          </Link>
        </div>
      </div>
    </div>
  );
}
