"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/select";

interface ContentItem {
  content_id: string;
  content_format: string;
  status: string;
  character_id: string | null;
  quality_score: number | null;
  created_at: string;
  approval_feedback: string | null;
}

// Page: Content Review — approve/reject UI
export default function ReviewPage() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [rejectionCategory, setRejectionCategory] = useState<
    Record<string, string>
  >({});

  const fetchPendingContent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        "/api/content?status=pending_approval&limit=50"
      );
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
    <div>
      <p className="mb-4 text-muted-foreground">
        {total} items pending approval
      </p>

      {loading ? (
        <p>Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">No items pending review</p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.content_id}>
              <CardContent className="pt-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">
                      {item.content_id}
                    </span>
                    <Badge>{item.content_format}</Badge>
                  </div>
                  {item.quality_score !== null && (
                    <span className="font-mono">
                      Score: {item.quality_score}
                    </span>
                  )}
                </div>

                <div className="mb-3">
                  <Textarea
                    placeholder="Feedback comment..."
                    rows={2}
                    value={feedback[item.content_id] || ""}
                    onChange={(e) =>
                      setFeedback({
                        ...feedback,
                        [item.content_id]: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="flex items-center gap-3">
                  <NativeSelect
                    className="w-auto"
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
                    <option value="data_insufficient">
                      Data Insufficient
                    </option>
                    <option value="hypothesis_weak">Hypothesis Weak</option>
                  </NativeSelect>

                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => handleApprove(item.content_id)}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleReject(item.content_id)}
                  >
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
