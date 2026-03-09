import Link from "next/link";

export const metadata = {
  title: "Terms of Service - AI Influencer Dashboard",
  description: "Terms of Service for AI Influencer Dashboard",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-2xl space-y-8 rounded-lg border bg-card p-4 shadow-lg sm:p-10">
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
            Effective Date: March 6, 2026
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            1. Acceptance of Terms
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            By accessing or using AI Influencer Dashboard, or by connecting any
            social media account to this application, you agree to be bound by
            these Terms of Service and our{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            . If you do not agree to these terms, do not access or use this
            application.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            2. Description of Service
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            AI Influencer Dashboard is an internal content management platform
            operated by{" "}
            <a
              href="https://ceed.cloud"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Ceed
            </a>
            . The Service automates the production, scheduling, posting, and
            performance measurement of AI-generated video content across the
            following platforms on behalf of authorized account operators:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>
              <strong className="text-foreground">YouTube</strong> &mdash; video
              uploads via the YouTube Data API v3 and analytics retrieval via the
              YouTube Analytics API v2.
            </li>
            <li>
              <strong className="text-foreground">TikTok</strong> &mdash; video
              publishing via the TikTok Content Posting API v2 and metrics
              retrieval via the TikTok Video Query API.
            </li>
            <li>
              <strong className="text-foreground">Instagram</strong> &mdash; Reels
              publishing via the Instagram Graph API v21.0 and insights retrieval
              via the Instagram Insights API.
            </li>
            <li>
              <strong className="text-foreground">X (Twitter)</strong> &mdash;
              video post creation via the X API v2 and engagement metrics
              retrieval.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            3. Authorized Use
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            This application is an internal tool. Access is restricted to
            authorized operators designated by Ceed. It is not a public service.
            As an authorized operator, you agree to:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>
              Use this application solely for lawful content creation and
              publishing purposes on accounts you own or are authorized to manage.
            </li>
            <li>
              Not use this application to post content that violates any
              applicable law, regulation, or the community guidelines or terms of
              service of any connected platform.
            </li>
            <li>
              Not use this application to post spam, coordinated inauthentic
              content, misinformation, or content that infringes the intellectual
              property or other rights of any third party.
            </li>
            <li>
              Maintain the confidentiality of your dashboard credentials and
              promptly notify Ceed of any unauthorized access.
            </li>
            <li>
              Not share, sublicense, or grant access to this application to any
              person not authorized by Ceed.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            4. Platform Terms Compliance
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            All content published and all actions taken through this application
            must comply with the terms of service and community guidelines of
            each connected platform. By using this application you agree to the
            following platform terms in addition to these Terms of Service:
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
              </a>{" "}
              and the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Google API Services User Data Policy
              </a>
            </li>
            <li>
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
            </li>
            <li>
              <a
                href="https://help.instagram.com/581066165581870"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Instagram Terms of Use
              </a>{" "}
              and the{" "}
              <a
                href="https://developers.facebook.com/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Meta Platform Terms
              </a>
            </li>
            <li>
              <a
                href="https://twitter.com/en/tos"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                X Terms of Service
              </a>{" "}
              and the{" "}
              <a
                href="https://developer.twitter.com/en/developer-terms/agreement-and-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                X Developer Agreement and Policy
              </a>
            </li>
          </ul>
          <p className="leading-relaxed text-muted-foreground">
            Ceed is not responsible for any enforcement actions taken by a
            platform against your account as a result of content posted or
            actions performed through this application.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            5. API Usage &amp; Restrictions
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            This application interacts with third-party platform APIs on your
            behalf. You agree to the following API usage obligations:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>
              You will not take any action through this application that would
              cause Ceed or its API credentials to exceed the rate limits or
              quota allocations imposed by any platform.
            </li>
            <li>
              You will not use this application to perform any action that
              violates a platform&apos;s developer policies, including but not
              limited to scraping, data harvesting, or artificial amplification
              of engagement signals.
            </li>
            <li>
              You will not attempt to reverse-engineer, circumvent, or interfere
              with any platform&apos;s API authentication or access controls.
            </li>
            <li>
              You will not use this application to send unsolicited or bulk
              promotional communications of any kind.
            </li>
            <li>
              You acknowledge that platform APIs and their terms may change at
              any time, and that certain features of this application may become
              unavailable as a result.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            6. OAuth Authorization
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            By connecting a social media account to this application via OAuth,
            you expressly authorize this application to perform the following
            actions on your behalf for that platform:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>
              <strong className="text-foreground">YouTube</strong> &mdash; upload
              videos to your channel, set video metadata (title, description,
              tags, visibility), and retrieve channel and video analytics.
            </li>
            <li>
              <strong className="text-foreground">TikTok</strong> &mdash; publish
              video content to your TikTok account and retrieve video performance
              metrics.
            </li>
            <li>
              <strong className="text-foreground">Instagram</strong> &mdash;
              publish Reels to your connected Instagram Business or Creator
              account via a linked Facebook Page, and retrieve content insights.
            </li>
            <li>
              <strong className="text-foreground">X (Twitter)</strong> &mdash;
              create posts (including video posts) on your X account and retrieve
              post engagement metrics.
            </li>
          </ul>
          <p className="leading-relaxed text-muted-foreground">
            OAuth access tokens and refresh tokens are stored securely and used
            only for the purposes described in this section and in our{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            . You may revoke this application&apos;s access to any connected
            account at any time through that platform&apos;s account settings or
            by contacting us at{" "}
            <a href="mailto:pochi@0xqube.xyz" className="text-primary hover:underline">
              pochi@0xqube.xyz
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            7. Intellectual Property
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            AI-generated content produced and published through this application
            is owned by the operator on whose behalf it was created, subject to
            any applicable laws governing AI-generated works in the relevant
            jurisdiction. Ceed does not claim ownership of any content produced
            or published through this application.
          </p>
          <p className="leading-relaxed text-muted-foreground">
            The AI Influencer Dashboard software, including its design, code,
            and all associated intellectual property, is owned by Ceed. No
            license to copy, modify, distribute, or create derivative works of
            the dashboard software is granted to operators.
          </p>
          <p className="leading-relaxed text-muted-foreground">
            You represent and warrant that you have all necessary rights to any
            source materials (scripts, audio, imagery) used to generate content
            published through this application, and that such content does not
            infringe any third-party intellectual property rights.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            8. Disclaimers &amp; Limitations of Liability
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            This application is provided &quot;as is&quot; and &quot;as
            available&quot; without warranties of any kind, express or implied,
            including but not limited to warranties of merchantability, fitness
            for a particular purpose, or non-infringement.
          </p>
          <p className="leading-relaxed text-muted-foreground">
            To the fullest extent permitted by applicable law, Ceed shall not be
            liable for any indirect, incidental, special, consequential, or
            punitive damages arising out of or related to your use of this
            application, including but not limited to:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>
              Suspension, termination, or restriction of any social media account
              by a third-party platform.
            </li>
            <li>
              Loss of followers, reach, revenue, or engagement due to content
              posted or actions taken through this application.
            </li>
            <li>
              Interruption or unavailability of this application or any
              third-party API.
            </li>
            <li>
              Loss or corruption of data, including OAuth credentials or content
              metadata.
            </li>
            <li>
              Changes to third-party platform APIs or policies that affect the
              functionality of this application.
            </li>
          </ul>
          <p className="leading-relaxed text-muted-foreground">
            You agree to indemnify and hold harmless Ceed and its officers,
            employees, and agents from any claims, damages, or expenses
            (including reasonable legal fees) arising from content posted through
            your authorized accounts or from your violation of these Terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            9. Changes to Terms
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            Ceed reserves the right to update or modify these Terms of Service
            at any time. When changes are made, the Effective Date at the top of
            this page will be updated. Continued use of this application after
            any such changes constitutes your acceptance of the revised Terms.
            It is your responsibility to review these Terms periodically.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            10. Governing Law
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            These Terms of Service are governed by and construed in accordance
            with the laws of Japan, without regard to its conflict of law
            provisions. Any disputes arising from these Terms or your use of
            this application shall be subject to the exclusive jurisdiction of
            the courts located in Japan.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            11. Contact
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            For questions about these Terms of Service, to request data deletion,
            or to revoke platform access, please contact us at{" "}
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
