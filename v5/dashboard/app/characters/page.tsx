"use client";

import { useState, useEffect } from "react";

export default function CharactersPage() {
  const [characters, setCharacters] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/accounts")
      .then((res) => res.json())
      .then(() => setCharacters([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <main className="p-6"><div role="progressbar">Loading...</div></main>;

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-6">Characters</h1>
      {characters.length === 0 ? (
        <div className="text-center py-8 text-[var(--muted)]">データがありません</div>
      ) : (
        <div className="space-y-3">
          {characters.map((c, i) => (
            <div key={i} className="p-4 rounded border border-[var(--border)]">{c.name as string}</div>
          ))}
        </div>
      )}
    </main>
  );
}
