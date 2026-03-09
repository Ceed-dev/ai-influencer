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

export function InstagramStartForm({ characters }: Props) {
  const { t } = useTranslation();
  const [characterId, setCharacterId] = useState("");
  const [platformUsername, setPlatformUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Server-side: generates CSRF nonce (stored in httpOnly cookie) + Facebook auth URL
      const res = await fetch("/api/auth/instagram/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform_username: platformUsername, character_id: characterId }),
      });
      if (!res.ok) throw new Error("Failed to initiate Instagram OAuth");
      const data = (await res.json()) as { authUrl: string };
      window.location.href = data.authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="character_id" className="text-sm font-medium leading-none">
          {t("instagramAuth.characterLabel")}
        </label>
        <NativeSelect
          id="character_id"
          value={characterId}
          onChange={(e) => setCharacterId(e.target.value)}
        >
          <option value="">{t("instagramAuth.characterPlaceholder")}</option>
          {characters.map((c) => (
            <option key={c.character_id} value={c.character_id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-2">
        <label htmlFor="platform_username" className="text-sm font-medium leading-none">
          {t("instagramAuth.usernameLabel")}
        </label>
        <Input
          id="platform_username"
          type="text"
          placeholder={t("instagramAuth.usernamePlaceholder")}
          value={platformUsername}
          onChange={(e) => setPlatformUsername(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? t("instagramAuth.connecting") : t("instagramAuth.connectButton")}
      </Button>
    </form>
  );
}
