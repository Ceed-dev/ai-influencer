import { query } from "@/lib/db";
import { TikTokStartForm } from "./TikTokStartForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Connect TikTok Account - AI Influencer Dashboard",
};

interface Character {
  character_id: string;
  name: string;
}

export default async function TikTokStartPage() {
  const characters = await query<Character>(
    `SELECT character_id, name FROM characters WHERE status = 'active' ORDER BY name ASC`
  );

  return (
    <div className="max-w-md mx-auto mt-10 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Connect TikTok Account</h1>
      <TikTokStartForm characters={characters} />
    </div>
  );
}
