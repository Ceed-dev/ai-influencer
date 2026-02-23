"use client";

import { useState, useEffect, useCallback } from "react";

interface ContentItem {
  content_id: string;
  title: string;
  content_format: string;
  review_status: string;
  quality_score: number;
  created_at: string;
}

export default function ContentPage() {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const fetchContent = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    params.set("page", page.toString());
    params.set("limit", limit.toString());

    fetch(`/api/content?${params}`)
      .then((res) => res.json())
      .then((data) => { setContent(data.content || []); setTotal(data.total || 0); })
      .finally(() => setLoading(false));
  }, [statusFilter, page]);

  useEffect(() => { fetchContent(); }, [fetchContent]);

  const totalPages = Math.ceil(total / limit);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-6">Content</h1>
      <div className="mb-4">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2 rounded bg-[var(--card-bg)] border border-[var(--border)]" aria-label="ステータス">
          <option value="">全ステータス</option>
          <option value="draft">draft</option>
          <option value="pending_approval">pending_approval</option>
          <option value="planned">planned</option>
          <option value="published">published</option>
        </select>
      </div>
      {loading ? <div role="progressbar">Loading...</div> : content.length === 0 ? (
        <div className="text-center py-8 text-[var(--muted)]">コンテンツがありません</div>
      ) : (
        <>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left p-2">ID</th>
                <th className="text-left p-2">タイトル</th>
                <th className="text-left p-2">フォーマット</th>
                <th className="text-left p-2">ステータス</th>
                <th className="text-left p-2">品質スコア</th>
              </tr>
            </thead>
            <tbody>
              {content.map((item) => (
                <tr key={item.content_id} className="border-b border-[var(--border)]">
                  <td className="p-2">{item.content_id}</td>
                  <td className="p-2 truncate max-w-xs">{item.title}</td>
                  <td className="p-2">{item.content_format}</td>
                  <td className="p-2">{item.review_status}</td>
                  <td className="p-2">{item.quality_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex gap-2 mt-4 justify-center">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1 rounded bg-[var(--card-bg)] border border-[var(--border)] disabled:opacity-50">前</button>
              <span className="px-3 py-1">{page} / {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-3 py-1 rounded bg-[var(--card-bg)] border border-[var(--border)] disabled:opacity-50">次</button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
