"use client";

import { useState, useEffect, useCallback } from "react";

interface Component {
  id: number;
  component_id: string;
  type: string;
  subtype: string;
  name: string;
  description: string;
  niche: string;
  score: number;
  curated_by: string;
  curation_confidence: number;
  review_status: string;
  created_at: string;
}

export default function CurationReviewPage() {
  const [components, setComponents] = useState<Component[]>([]);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchComponents = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ review_status: "pending_review" });
    if (typeFilter) params.set("type", typeFilter);

    fetch(`/api/components?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setComponents(data.components || []);
        setTotal(data.total || 0);
      })
      .finally(() => setLoading(false));
  }, [typeFilter]);

  useEffect(() => {
    fetchComponents();
  }, [fetchComponents]);

  const handleApprove = async (id: number) => {
    // In a real app this would call an API to update the component
    setComponents((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-6">Curation Review</h1>
      <p className="mb-4 text-[var(--muted)]">pending_review のコンポーネント: {total}件</p>

      <div className="mb-4">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 rounded bg-[var(--card-bg)] border border-[var(--border)]"
          aria-label="コンポーネントタイプ"
        >
          <option value="">全タイプ</option>
          <option value="scenario">scenario</option>
          <option value="motion">motion</option>
          <option value="audio">audio</option>
          <option value="image">image</option>
        </select>
      </div>

      {loading ? (
        <div role="progressbar">Loading...</div>
      ) : components.length === 0 ? (
        <div className="text-center py-8 text-[var(--muted)]">レビュー待ちのコンポーネントはありません</div>
      ) : (
        <div className="space-y-3">
          {components.map((comp) => (
            <div key={comp.id} className="p-4 rounded border border-[var(--border)] bg-[var(--card-bg)]" data-component-id={comp.component_id}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{comp.name}</h3>
                  <p className="text-sm text-[var(--muted)]">{comp.type}{comp.subtype ? ` / ${comp.subtype}` : ""}</p>
                  {comp.description && <p className="text-sm mt-1">{comp.description}</p>}
                </div>
                <div className="text-right text-sm">
                  <p>自信度: {comp.curation_confidence ?? "-"}</p>
                  <p>スコア: {comp.score ?? "-"}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleApprove(comp.id)}
                  className="px-3 py-1 bg-green-700 text-white rounded text-sm"
                >
                  承認
                </button>
                <button
                  className="px-3 py-1 bg-red-700 text-white rounded text-sm"
                >
                  差し戻し
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
