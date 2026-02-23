"use client";

import { useState, useEffect, useCallback } from "react";

interface Directive {
  id: number;
  directive_type: string;
  content: string;
  target_agents: string[];
  status: string;
  priority: string;
  created_at: string;
}

export default function DirectivesPage() {
  const [directives, setDirectives] = useState<Directive[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDirectives = useCallback(() => {
    setLoading(true);
    fetch("/api/directives")
      .then((res) => res.json())
      .then((data) => setDirectives(data.directives || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchDirectives(); }, [fetchDirectives]);

  if (loading) return <main className="p-6"><div role="progressbar">Loading...</div></main>;

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-6">Human Directives</h1>
      {directives.length === 0 ? (
        <div className="text-center py-8 text-[var(--muted)]">データがありません</div>
      ) : (
        <div className="space-y-3">
          {directives.map((d) => (
            <div key={d.id} className="p-4 rounded border border-[var(--border)] bg-[var(--card-bg)]">
              <div className="flex justify-between">
                <span className="font-semibold">{d.directive_type}</span>
                <span className={`px-2 py-1 rounded text-xs ${d.status === "applied" ? "bg-green-900 text-green-200" : "bg-yellow-900 text-yellow-200"}`}>{d.status}</span>
              </div>
              <p className="mt-1">{d.content}</p>
              <p className="text-sm text-[var(--muted)] mt-1">Priority: {d.priority}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
