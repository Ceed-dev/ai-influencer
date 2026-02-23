"use client";

import { useState, useEffect, useCallback } from "react";

interface ContentItem {
  content_id: string;
  content_format: string;
  status: string;
  character_id: string | null;
  quality_score: number | null;
  created_at: string;
  approval_feedback: string | null;
}

export default function ReviewPage() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [rejectionCategory, setRejectionCategory] = useState<Record<string, string>>({});

  const fetchPendingContent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/content?status=pending_approval&limit=50");
      const data = await res.json();
      setItems(data.content || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to fetch content:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingContent();
  }, [fetchPendingContent]);

  const handleApprove = async (contentId: string) => {
    try {
      const res = await fetch(`/api/content/${contentId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: feedback[contentId] || "" }),
      });
      if (res.ok) {
        fetchPendingContent();
      }
    } catch (err) {
      console.error("Approve failed:", err);
    }
  };

  const handleReject = async (contentId: string) => {
    const comment = feedback[contentId];
    const category = rejectionCategory[contentId];
    if (!comment) {
      alert("Rejection requires a comment");
      return;
    }
    if (!category) {
      alert("Please select a rejection category");
      return;
    }
    try {
      const res = await fetch(`/api/content/${contentId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment, rejection_category: category }),
      });
      if (res.ok) {
        fetchPendingContent();
      }
    } catch (err) {
      console.error("Reject failed:", err);
    }
  };

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">Content Review</h1>
      <p className="mb-4" style={{ color: "var(--muted)" }}>
        {total} items pending approval
      </p>

      {loading ? (
        <p>Loading...</p>
      ) : items.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No items pending review</p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.content_id}
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: "var(--card-bg)",
                borderColor: "var(--border)",
              }}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="font-mono text-sm">{item.content_id}</span>
                  <span
                    className="ml-2 px-2 py-1 rounded text-xs"
                    style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}
                  >
                    {item.content_format}
                  </span>
                </div>
                {item.quality_score !== null && (
                  <span className="font-mono">
                    Score: {item.quality_score}
                  </span>
                )}
              </div>

              <div className="mb-3">
                <textarea
                  className="w-full p-2 rounded text-sm"
                  style={{
                    backgroundColor: "var(--bg)",
                    color: "var(--fg)",
                    borderColor: "var(--border)",
                  }}
                  placeholder="Feedback comment..."
                  rows={2}
                  value={feedback[item.content_id] || ""}
                  onChange={(e) =>
                    setFeedback({ ...feedback, [item.content_id]: e.target.value })
                  }
                />
              </div>

              <div className="flex items-center gap-3">
                <select
                  className="p-2 rounded text-sm"
                  style={{
                    backgroundColor: "var(--bg)",
                    color: "var(--fg)",
                  }}
                  value={rejectionCategory[item.content_id] || ""}
                  onChange={(e) =>
                    setRejectionCategory({
                      ...rejectionCategory,
                      [item.content_id]: e.target.value,
                    })
                  }
                >
                  <option value="">Rejection category...</option>
                  <option value="plan_revision">Plan Revision</option>
                  <option value="data_insufficient">Data Insufficient</option>
                  <option value="hypothesis_weak">Hypothesis Weak</option>
                </select>

                <button
                  className="px-4 py-2 rounded font-semibold text-sm"
                  style={{ backgroundColor: "var(--success)", color: "#fff" }}
                  onClick={() => handleApprove(item.content_id)}
                >
                  Approve
                </button>
                <button
                  className="px-4 py-2 rounded font-semibold text-sm"
                  style={{ backgroundColor: "var(--error)", color: "#fff" }}
                  onClick={() => handleReject(item.content_id)}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
