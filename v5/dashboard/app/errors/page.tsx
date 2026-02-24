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

interface ErrorEntry {
  id: number;
  task_type: string;
  task_id: number;
  error_message: string;
  retry_count: number;
  status: string;
  created_at: string;
  resolved_at: string;
}

export default function ErrorLogPage() {
  const [errors, setErrors] = useState<ErrorEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [period, setPeriod] = useState<string>("");
  const [taskType, setTaskType] = useState<string>("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchErrors = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (period) params.set("period", period);
    if (taskType) params.set("task_type", taskType);
    params.set("page", page.toString());
    params.set("limit", "20");

    fetch(`/api/errors?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setErrors(data.errors || []);
        setTotal(data.total || 0);
      })
      .finally(() => setLoading(false));
  }, [period, taskType, page]);

  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <div className="flex gap-4 mb-4" data-testid="error-filter-bar">
        <NativeSelect
          className="w-auto"
          value={period}
          onChange={(e) => {
            setPeriod(e.target.value);
            setPage(1);
          }}
          aria-label="期間"
        >
          <option value="">全期間</option>
          <option value="24h">過去24時間</option>
          <option value="7d">過去7日間</option>
          <option value="30d">過去30日間</option>
        </NativeSelect>

        <NativeSelect
          className="w-auto"
          value={taskType}
          onChange={(e) => {
            setTaskType(e.target.value);
            setPage(1);
          }}
          aria-label="タスクタイプ"
        >
          <option value="">全タスクタイプ</option>
          <option value="produce">produce</option>
          <option value="publish">publish</option>
          <option value="measure">measure</option>
          <option value="curate">curate</option>
        </NativeSelect>
      </div>

      {loading ? (
        <div role="progressbar">Loading...</div>
      ) : errors.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          データがありません
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>タスクタイプ</TableHead>
                <TableHead>エラーメッセージ</TableHead>
                <TableHead>リトライ数</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>発生日時</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {errors.map((err) => (
                <TableRow key={err.id} data-error-id={err.id}>
                  <TableCell>{err.id}</TableCell>
                  <TableCell>{err.task_type}</TableCell>
                  <TableCell
                    className="truncate max-w-xs"
                    title={err.error_message}
                  >
                    {err.error_message}
                  </TableCell>
                  <TableCell>{err.retry_count}</TableCell>
                  {/* Status color: bg-red-900 for failed, bg-yellow-900 for others */}
                  <TableCell>
                    <Badge
                      variant={
                        err.status === "failed" ? "destructive" : "warning"
                      }
                    >
                      {err.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(err.created_at).toLocaleString("ja-JP")}
                  </TableCell>
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
