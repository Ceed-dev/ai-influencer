import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

export const metadata = {
  title: "Demo - AI Influencer Dashboard",
};

const DEMOS = [
  {
    platform: "TikTok",
    href: "/demo/tiktok",
    description: "Connect TikTok account, post a video via Direct Post API, and view video metrics.",
  },
  {
    platform: "Instagram",
    href: "/demo/instagram",
    description: "Fetch Instagram account info and Facebook Page details, publish a photo post, and view account/page insights.",
  },
  {
    platform: "YouTube",
    href: "/demo/youtube",
    description: "Connect YouTube channel via OAuth 2.0, upload a video via YouTube Data API v3, and view channel analytics via YouTube Analytics API v2.",
  },
];

export default async function DemoIndexPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    redirect("/login");
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Platform Demos</h1>
      <p className="text-muted-foreground text-sm">
        End-to-end demos for each platform API integration. Used for App Review submissions.
      </p>
      <div className="grid gap-4">
        {DEMOS.map((demo) => (
          <Link
            key={demo.platform}
            href={demo.href}
            className="block rounded-lg border bg-card p-5 hover:bg-muted transition-colors"
          >
            <h2 className="font-semibold text-foreground">{demo.platform}</h2>
            <p className="text-sm text-muted-foreground mt-1">{demo.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
