"use client";

import { useState, FormEvent } from "react";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";

interface Character {
  character_id: string;
  name: string;
}

interface Props {
  characters: Character[];
}

const REDIRECT_URI = "https://ai-dash.0xqube.xyz/api/auth/tiktok/callback";
const SCOPES = "video.upload,video.list,user.info.basic";

export function TikTokStartForm({ characters }: Props) {
  const { t } = useTranslation();
  const [characterId, setCharacterId] = useState("");
  const [platformUsername, setPlatformUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!characterId) return;

    setLoading(true);
    setError("");

    try {
      // Fetch client_key from server-side API (avoids exposing key in NEXT_PUBLIC_*)
      const res = await fetch("/api/settings/TIKTOK_CLIENT_KEY");
      if (!res.ok) throw new Error("Failed to fetch TikTok client key");
      const data = (await res.json()) as { value: string };
      const clientKey = data.value;

      const state = btoa(
        JSON.stringify({ platform_username: platformUsername, character_id: characterId })
      );

      const authUrl = new URL("https://www.tiktok.com/v2/auth/authorize/");
      authUrl.searchParams.set("client_key", clientKey);
      authUrl.searchParams.set("scope", SCOPES);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
      authUrl.searchParams.set("state", state);

      window.location.href = authUrl.toString();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="character_id" className="text-sm font-medium leading-none">
          {t("tiktokAuth.characterLabel")}
        </label>
        <NativeSelect
          id="character_id"
          value={characterId}
          onChange={(e) => setCharacterId(e.target.value)}
          required
        >
          <option value="">{t("tiktokAuth.characterPlaceholder")}</option>
          {characters.map((c) => (
            <option key={c.character_id} value={c.character_id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-2">
        <label htmlFor="platform_username" className="text-sm font-medium leading-none">
          {t("tiktokAuth.usernameLabel")}
        </label>
        <Input
          id="platform_username"
          type="text"
          placeholder={t("tiktokAuth.usernamePlaceholder")}
          value={platformUsername}
          onChange={(e) => setPlatformUsername(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={!characterId || loading} className="w-full">
        {loading ? t("tiktokAuth.connecting") : t("tiktokAuth.connectButton")}
      </Button>
    </form>
  );
}
