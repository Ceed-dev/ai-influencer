import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { YouTubeDemoClient } from "./YouTubeDemoClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "YouTube Demo - AI Influencer Dashboard",
};

interface AccountRow {
  platform_username: string;
}

export default async function YouTubeDemoPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    redirect("/login");
  }

  const account = await queryOne<AccountRow>(
    `SELECT platform_username
     FROM accounts
     WHERE platform = 'youtube' AND status = 'active'
     ORDER BY updated_at DESC
     LIMIT 1`
  );

  return (
    <div className="p-6">
      <YouTubeDemoClient connectedAccount={account ?? null} />
    </div>
  );
}
