"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
      .then((data) => {
        setContent(data.content || []);
        setTotal(data.total || 0);
      })
      .finally(() => setLoading(false));
  }, [statusFilter, page]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="mb-4">
        <NativeSelect
          className="w-auto"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          aria-label="ステータス"
        >
          <option value="">全ステータス</option>
          <option value="draft">draft</option>
          <option value="pending_approval">pending_approval</option>
          <option value="planned">planned</option>
          <option value="published">published</option>
        </NativeSelect>
      </div>
      {loading ? (
        <div role="progressbar">Loading...</div>
      ) : content.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          コンテンツがありません
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>タイトル</TableHead>
                <TableHead>フォーマット</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>品質スコア</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {content.map((item) => (
                <TableRow key={item.content_id}>
                  <TableCell>{item.content_id}</TableCell>
                  <TableCell className="truncate max-w-xs">
                    {item.title}
                  </TableCell>
                  <TableCell>{item.content_format}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{item.review_status}</Badge>
                  </TableCell>
                  <TableCell>{item.quality_score}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex gap-2 mt-4 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                前
              </Button>
              <span className="px-3 py-1 text-sm">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
              >
                次
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
