"use client";

import { useState, useEffect } from "react";

export default function LearningsPage() {
  const [learnings, setLearnings] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/learnings")
      .then((res) => res.json())
      .then((data) => setLearnings(data.learnings || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <main className="p-6"><div role="progressbar">Loading...</div></main>;

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-6">Learnings</h1>
      {learnings.length === 0 ? (
        <div className="text-center py-8 text-[var(--muted)]">データがありません</div>
      ) : (
        <div className="space-y-3">
          {learnings.map((l, i) => (
            <div key={i} className="p-4 rounded border border-[var(--border)] bg-[var(--card-bg)]">
              <p>{l.insight as string}</p>
              <p className="text-sm text-[var(--muted)] mt-1">{l.category as string} | confidence: {String(l.confidence)}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
