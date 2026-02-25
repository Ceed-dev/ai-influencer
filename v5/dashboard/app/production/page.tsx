"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/lib/i18n";

interface Task {
  id: number;
  task_type: string;
  payload: Record<string, unknown>;
  status: string;
  priority: number;
  assigned_worker: string | null;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  last_error_at: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

const STATUS_OPTIONS = [
  "pending", "queued", "waiting", "processing", "retrying",
  "completed", "failed", "failed_permanent",
] as const;

const TASK_TYPES = ["produce", "publish", "measure", "curate"] as const;

export default function ProductionPage() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [taskTypeFilter, setTaskTypeFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const fetchTasks = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (taskTypeFilter) params.set("task_type", taskTypeFilter);
    params.set("page", page.toString());
    params.set("limit", limit.toString());

    fetch(`/api/production?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setTasks(data.tasks || []);
        setTotal(data.total || 0);
        setStatusCounts(data.status_counts || {});
      })
      .catch((err) => console.error("Failed to fetch tasks:", err))
      .finally(() => setLoading(false));
  }, [statusFilter, taskTypeFilter, page]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const totalPages = Math.ceil(total / limit);

  const statusVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "success" as const;
      case "processing":
        return "default" as const;
      case "failed":
      case "failed_permanent":
        return "destructive" as const;
      case "retrying":
        return "warning" as const;
      default:
        return "secondary" as const;
    }
  };

  const priorityLabel = (priority: number) => {
    if (priority >= 10) return { text: t("production.priorityUrgent"), variant: "destructive" as const };
    if (priority >= 5) return { text: t("production.priorityHigh"), variant: "warning" as const };
    if (priority >= 1) return { text: t("production.priorityNormal"), variant: "secondary" as const };
    return { text: t("production.priorityLow"), variant: "outline" as const };
  };

  const payloadSummary = (payload: Record<string, unknown>): string => {
    const contentId = payload.content_id;
    const accountId = payload.account_id;
    const parts: string[] = [];
    if (contentId) parts.push(String(contentId));
    if (accountId) parts.push(String(accountId));
    if (parts.length === 0) return JSON.stringify(payload).slice(0, 60);
    return parts.join(" / ");
  };

  const totalAll = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const activeCount =
    (statusCounts["processing"] || 0) +
    (statusCounts["retrying"] || 0);
  const pendingCount =
    (statusCounts["pending"] || 0) +
    (statusCounts["queued"] || 0) +
    (statusCounts["waiting"] || 0);
  const failedCount =
    (statusCounts["failed"] || 0) +
    (statusCounts["failed_permanent"] || 0);

  return (
    <div>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("production.totalTasks")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAll}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("production.active")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("production.pending")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-400">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("production.completed")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">
              {statusCounts["completed"] || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("production.failed")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">{failedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <NativeSelect
          className="w-auto"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Status filter"
        >
          <option value="">{t("common.allStatuses")}</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")} ({statusCounts[s] || 0})
            </option>
          ))}
        </NativeSelect>

        <NativeSelect
          className="w-auto"
          value={taskTypeFilter}
          onChange={(e) => {
            setTaskTypeFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Task type filter"
        >
          <option value="">{t("common.allTypes")}</option>
          {TASK_TYPES.map((tt) => (
            <option key={tt} value={tt}>
              {tt}
            </option>
          ))}
        </NativeSelect>

        <Button variant="outline" size="sm" onClick={fetchTasks}>
          {t("common.refresh")}
        </Button>
      </div>

      {/* Task Table */}
      {loading ? (
        <div role="progressbar">{t("common.loading")}</div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t("production.noTasksFound")}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("production.id")}</TableHead>
                <TableHead>{t("production.type")}</TableHead>
                <TableHead>{t("production.status")}</TableHead>
                <TableHead>{t("production.priority")}</TableHead>
                <TableHead>{t("production.payload")}</TableHead>
                <TableHead>{t("production.retries")}</TableHead>
                <TableHead>{t("production.worker")}</TableHead>
                <TableHead>{t("production.created")}</TableHead>
                <TableHead>{t("production.started")}</TableHead>
                <TableHead>{t("production.completedAt")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => {
                const prio = priorityLabel(task.priority);
                return (
                  <TableRow key={task.id}>
                    <TableCell className="font-mono text-xs">{task.id}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{task.task_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(task.status)}>
                        {task.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={prio.variant}>{prio.text}</Badge>
                    </TableCell>
                    <TableCell
                      className="font-mono text-xs truncate max-w-[200px]"
                      title={JSON.stringify(task.payload)}
                    >
                      {payloadSummary(task.payload)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {task.retry_count}/{task.max_retries}
                    </TableCell>
                    <TableCell className="text-xs truncate max-w-[100px]">
                      {task.assigned_worker || "-"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(task.created_at).toLocaleString("ja-JP")}
                    </TableCell>
                    <TableCell className="text-xs">
                      {task.started_at
                        ? new Date(task.started_at).toLocaleString("ja-JP")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {task.completed_at
                        ? new Date(task.completed_at).toLocaleString("ja-JP")
                        : "-"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Error details for failed tasks */}
          {tasks.some((tk) => tk.error_message) && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-lg">{t("production.errorDetails")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {tasks
                  .filter((tk) => tk.error_message)
                  .map((tk) => (
                    <div
                      key={`error-${tk.id}`}
                      className="p-2 border rounded text-xs"
                    >
                      <span className="font-mono font-bold">Task #{tk.id}:</span>{" "}
                      <span className="text-red-400">{tk.error_message}</span>
                      {tk.last_error_at && (
                        <span className="text-muted-foreground ml-2">
                          ({new Date(tk.last_error_at).toLocaleString("ja-JP")})
                        </span>
                      )}
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}

          {totalPages > 1 && (
            <div className="flex gap-2 mt-4 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                {t("common.prev")}
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
                {t("common.next")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
