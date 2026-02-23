"use client";

import { useState, useEffect } from "react";

export default function HypothesesPage() {
  const [hypotheses, setHypotheses] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/hypotheses")
      .then((res) => res.json())
      .then((data) => setHypotheses(data.hypotheses || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <main className="p-6"><div role="progressbar">Loading...</div></main>;

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-6">Hypotheses</h1>
      {hypotheses.length === 0 ? (
        <div className="text-center py-8 text-[var(--muted)]">データがありません</div>
      ) : (
        <div className="space-y-3">
          {hypotheses.map((h, i) => (
            <div key={i} className="p-4 rounded border border-[var(--border)] bg-[var(--card-bg)]">
              <p className="font-semibold">{h.hypothesis as string}</p>
              <p className="text-sm text-[var(--muted)] mt-1">{h.category as string} | {h.verdict as string}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
