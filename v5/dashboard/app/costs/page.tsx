"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CostSummary {
  daily_spend: number;
  daily_task_count: number;
  daily_budget: number;
  daily_remaining: number;
  monthly_spend: number;
  monthly_task_count: number;
  monthly_budget: number;
  monthly_remaining: number;
  budget_utilization_percent: number;
  alert_active: boolean;
  actual_tracked_cost: number;
  actual_tracked_count: number;
}

interface DailySpend {
  date: string;
  task_count: number;
  estimated_cost: number;
}

interface RecentTask {
  id: number;
  task_type: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  payload_summary: string;
  estimated_cost: number;
}

interface CostData {
  settings: {
    daily_budget_usd: number;
    monthly_budget_usd: number;
    alert_threshold_percent: number;
  };
  summary: CostSummary;
  daily_history: DailySpend[];
  recent_tasks: RecentTask[];
}

export default function CostsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/costs")
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch((err) => console.error("Failed to fetch costs:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <div role="progressbar">{t("common.loading")}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t("costs.failedToLoad")}
      </div>
    );
  }

  const { summary, daily_history, recent_tasks, settings } = data;

  const utilizationVariant = () => {
    if (summary.budget_utilization_percent >= settings.alert_threshold_percent) return "destructive" as const;
    if (summary.budget_utilization_percent >= 60) return "warning" as const;
    return "success" as const;
  };

  const formatUsd = (amount: number) => `$${amount.toFixed(2)}`;

  return (
    <div>
      {/* Budget Alert */}
      {summary.alert_active && (
        <div className="mb-6 p-4 border border-red-500 rounded-lg bg-red-950/20">
          <p className="text-red-400 font-semibold">
            {t("costs.budgetAlert").replace("{percent}", String(summary.budget_utilization_percent)).replace("{budget}", formatUsd(summary.monthly_budget)).replace("{threshold}", String(settings.alert_threshold_percent))}
          </p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("costs.todaysSpend")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatUsd(summary.daily_spend)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("costs.tasksBudget").replace("{count}", String(summary.daily_task_count)).replace("{budget}", formatUsd(summary.daily_budget))}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("costs.monthlySpend")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatUsd(summary.monthly_spend)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("costs.tasksBudget").replace("{count}", String(summary.monthly_task_count)).replace("{budget}", formatUsd(summary.monthly_budget))}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("costs.budgetRemaining")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatUsd(summary.monthly_remaining)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("costs.dailyRemaining").replace("{amount}", formatUsd(summary.daily_remaining))}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("costs.budgetUtilization")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge variant={utilizationVariant()} className="text-lg px-3 py-1">
                {summary.budget_utilization_percent}%
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("costs.alertAt").replace("{percent}", String(settings.alert_threshold_percent))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tracked Costs */}
      {summary.actual_tracked_count > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("costs.trackedApiCosts")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {formatUsd(summary.actual_tracked_cost)}{" "}
              <span className="text-xs text-muted-foreground font-normal">
                {t("costs.fromRecordedExperiences").replace("{count}", String(summary.actual_tracked_count))}
              </span>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Daily Spend History */}
      {daily_history.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">{t("costs.dailySpendLast7")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("costs.date")}</TableHead>
                  <TableHead>{t("costs.tasks")}</TableHead>
                  <TableHead>{t("costs.estimatedCost")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {daily_history.map((day) => (
                  <TableRow key={day.date}>
                    <TableCell>{day.date}</TableCell>
                    <TableCell>{day.task_count}</TableCell>
                    <TableCell className="font-mono">
                      {formatUsd(day.estimated_cost)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("costs.recentCompletedTasks")}</CardTitle>
        </CardHeader>
        <CardContent>
          {recent_tasks.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              {t("costs.noCompletedTasks")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("errors.id")}</TableHead>
                  <TableHead>{t("costs.type")}</TableHead>
                  <TableHead>{t("costs.contentCol")}</TableHead>
                  <TableHead>{t("costs.completedCol")}</TableHead>
                  <TableHead>{t("costs.estCost")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent_tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-mono text-xs">{task.id}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{task.task_type}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs truncate max-w-[200px]">
                      {task.payload_summary}
                    </TableCell>
                    <TableCell className="text-xs">
                      {task.completed_at
                        ? new Date(task.completed_at).toLocaleString("ja-JP")
                        : "-"}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatUsd(task.estimated_cost)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
