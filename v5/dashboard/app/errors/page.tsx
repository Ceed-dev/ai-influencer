"use client";

import { useState } from "react";
import useSWR from "swr";
import { RotateCcw, Ban } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
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
import { fetcher, swrConfig } from "@/lib/swr-config";

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

interface ErrorsResponse {
  errors: ErrorEntry[];
  total: number;
}

export default function ErrorLogPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<string>("");
  const [taskType, setTaskType] = useState<string>("");
  const [page, setPage] = useState(1);
  const [actionInProgress, setActionInProgress] = useState<number | null>(null);

  // Build SWR key from filter params
  const params = new URLSearchParams();
  if (period) params.set("period", period);
  if (taskType) params.set("task_type", taskType);
  params.set("page", page.toString());
  params.set("limit", "20");
  const swrKey = `/api/errors?${params.toString()}`;

  const { data, isLoading, mutate } = useSWR<ErrorsResponse>(swrKey, fetcher, {
    refreshInterval: swrConfig.refreshInterval,
    revalidateOnFocus: swrConfig.revalidateOnFocus,
    dedupingInterval: swrConfig.dedupingInterval,
  });

  const errors = data?.errors ?? [];
  const total = data?.total ?? 0;

  const handleAction = async (taskId: number, action: "retry" | "abandon") => {
    setActionInProgress(taskId);
    try {
      const res = await fetch("/api/errors", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, action }),
      });
      if (res.ok) {
        mutate();
      } else {
        const responseData = await res.json();
        console.error("Action failed:", responseData.error);
      }
    } catch (err) {
      console.error("Action failed:", err);
    } finally {
      setActionInProgress(null);
    }
  };

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
          aria-label={t("errors.period")}
        >
          <option value="">{t("errors.allPeriods")}</option>
          <option value="24h">{t("errors.last24h")}</option>
          <option value="7d">{t("errors.last7d")}</option>
          <option value="30d">{t("errors.last30d")}</option>
        </NativeSelect>

        <NativeSelect
          className="w-auto"
          value={taskType}
          onChange={(e) => {
            setTaskType(e.target.value);
            setPage(1);
          }}
          aria-label={t("errors.taskType")}
        >
          <option value="">{t("errors.allTaskTypes")}</option>
          <option value="produce">produce</option>
          <option value="publish">publish</option>
          <option value="measure">measure</option>
          <option value="curate">curate</option>
        </NativeSelect>
      </div>

      {isLoading ? (
        <div role="progressbar">{t("common.loading")}</div>
      ) : errors.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t("common.noData")}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("errors.id")}</TableHead>
                <TableHead>{t("errors.taskType")}</TableHead>
                <TableHead>{t("errors.errorMessage")}</TableHead>
                <TableHead>{t("errors.retryCount")}</TableHead>
                <TableHead>{t("errors.status")}</TableHead>
                <TableHead>{t("errors.occurredAt")}</TableHead>
                <TableHead>{t("errors.action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {errors.map((err) => {
                const canRetry =
                  err.status === "failed" || err.status === "retrying";
                const canAbandon = err.status === "retrying";
                const isProcessing = actionInProgress === err.id;

                return (
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
                    <TableCell>
                      <Badge
                        variant={
                          err.status === "failed" ? "destructive" : "warning"
                        }
                        className={
                          err.status === "failed"
                            ? "bg-red-900 text-red-100"
                            : "bg-yellow-900 text-yellow-100"
                        }
                      >
                        {err.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(err.created_at).toLocaleString("ja-JP")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {canRetry && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isProcessing}
                            onClick={() => handleAction(err.task_id, "retry")}
                            title="Retry task"
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            {t("errors.retryBtn")}
                          </Button>
                        )}
                        {canAbandon && (
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={isProcessing}
                            onClick={() => handleAction(err.task_id, "abandon")}
                            title="Abandon task permanently"
                          >
                            <Ban className="h-3 w-3 mr-1" />
                            {t("errors.abandonBtn")}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
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
