import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { TikTokDemoClient } from "./TikTokDemoClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "TikTok Demo - AI Influencer Dashboard",
};

interface AccountRow {
  platform_username: string;
}

export default async function TikTokDemoPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    redirect("/login");
  }

  const account = await queryOne<AccountRow>(
    `SELECT platform_username
     FROM accounts
     WHERE platform = 'tiktok' AND status = 'active'
     ORDER BY updated_at DESC
     LIMIT 1`
  );

  return (
    <div className="p-6">
      <TikTokDemoClient connectedAccount={account ?? null} />
    </div>
  );
}
