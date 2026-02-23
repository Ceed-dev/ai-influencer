"use client";

import { useState, useEffect, useCallback } from "react";

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
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-6">Error Log</h1>

      <div className="flex gap-4 mb-4" data-testid="error-filter-bar">
        <select
          value={period}
          onChange={(e) => { setPeriod(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded bg-[var(--card-bg)] border border-[var(--border)]"
          aria-label="期間"
        >
          <option value="">全期間</option>
          <option value="24h">過去24時間</option>
          <option value="7d">過去7日間</option>
          <option value="30d">過去30日間</option>
        </select>

        <select
          value={taskType}
          onChange={(e) => { setTaskType(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded bg-[var(--card-bg)] border border-[var(--border)]"
          aria-label="タスクタイプ"
        >
          <option value="">全タスクタイプ</option>
          <option value="produce">produce</option>
          <option value="publish">publish</option>
          <option value="measure">measure</option>
          <option value="curate">curate</option>
        </select>
      </div>

      {loading ? (
        <div role="progressbar">Loading...</div>
      ) : errors.length === 0 ? (
        <div className="text-center py-8 text-[var(--muted)]">
          データがありません
        </div>
      ) : (
        <>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left p-2">ID</th>
                <th className="text-left p-2">タスクタイプ</th>
                <th className="text-left p-2">エラーメッセージ</th>
                <th className="text-left p-2">リトライ数</th>
                <th className="text-left p-2">ステータス</th>
                <th className="text-left p-2">発生日時</th>
              </tr>
            </thead>
            <tbody>
              {errors.map((err) => (
                <tr key={err.id} className="border-b border-[var(--border)] hover:bg-[var(--sidebar-bg)]" data-error-id={err.id}>
                  <td className="p-2">{err.id}</td>
                  <td className="p-2">{err.task_type}</td>
                  <td className="p-2 truncate max-w-xs" title={err.error_message}>{err.error_message}</td>
                  <td className="p-2">{err.retry_count}</td>
                  <td className="p-2">
                    <span className={`px-2 py-1 rounded text-xs ${err.status === "failed" ? "bg-red-900 text-red-200" : "bg-yellow-900 text-yellow-200"}`}>
                      {err.status}
                    </span>
                  </td>
                  <td className="p-2">{new Date(err.created_at).toLocaleString("ja-JP")}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex gap-2 mt-4 justify-center">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded bg-[var(--card-bg)] border border-[var(--border)] disabled:opacity-50"
              >
                前
              </button>
              <span className="px-3 py-1">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded bg-[var(--card-bg)] border border-[var(--border)] disabled:opacity-50"
              >
                次
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
