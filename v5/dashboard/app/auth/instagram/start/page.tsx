import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { InstagramStartForm } from "./InstagramStartForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Connect Instagram Account - AI Influencer Dashboard",
};

interface Character {
  character_id: string;
  name: string;
}

export default async function InstagramStartPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    redirect("/login");
  }

  const characters = await query<Character>(
    `SELECT character_id, name FROM characters WHERE status = 'active' ORDER BY name ASC`
  );

  return (
    <div className="max-w-md mx-auto mt-10 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Connect Instagram Account</h1>
      <InstagramStartForm characters={characters} />
    </div>
  );
}
