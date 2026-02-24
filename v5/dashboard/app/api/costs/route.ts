import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

interface CostSettings {
  daily_budget_usd: number;
  monthly_budget_usd: number;
  alert_threshold_percent: number;
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

/**
 * GET /api/costs
 * Returns cost overview: settings, daily spend, monthly totals, recent tasks with cost estimates.
 */
export async function GET() {
  // 1. Fetch cost-related settings
  const costSettings = await query<{ setting_key: string; setting_value: unknown }>(
    `SELECT setting_key, setting_value FROM system_settings WHERE category = 'cost_control' ORDER BY setting_key ASC`
  );

  const settingsMap: Record<string, unknown> = {};
  for (const s of costSettings) {
    settingsMap[s.setting_key] = s.setting_value;
  }

  const dailyBudget = Number(settingsMap["DAILY_API_BUDGET_USD"] ?? 50);
  const monthlyBudget = Number(settingsMap["MONTHLY_API_BUDGET_USD"] ?? 1500);
  const alertThreshold = Number(settingsMap["BUDGET_ALERT_THRESHOLD_PERCENT"] ?? 80);

  const settings: CostSettings = {
    daily_budget_usd: dailyBudget,
    monthly_budget_usd: monthlyBudget,
    alert_threshold_percent: alertThreshold,
  };

  // 2. Per-tool cost estimates (from tool_catalog cost_per_use)
  const toolCosts = await query<{ tool_name: string; cost_per_use: number }>(
    `SELECT tool_name, COALESCE(cost_per_use, 0) as cost_per_use FROM tool_catalog WHERE is_active = true`
  );
  const costMap: Record<string, number> = {};
  for (const t of toolCosts) {
    costMap[t.tool_name] = Number(t.cost_per_use);
  }

  // 3. Today's completed tasks for daily spend
  const todaySpend = await queryOne<{ task_count: string; total_cost: string }>(
    `SELECT COUNT(*) as task_count,
            COALESCE(SUM(
              CASE
                WHEN te.cost_actual IS NOT NULL THEN te.cost_actual
                ELSE COALESCE(tc.cost_per_use, 0.10)
              END
            ), 0) as total_cost
     FROM task_queue tq
     LEFT JOIN tool_experiences te ON te.content_id = (tq.payload->>'content_id')
     LEFT JOIN tool_catalog tc ON tc.tool_name = tq.task_type
     WHERE tq.status = 'completed'
       AND tq.completed_at >= CURRENT_DATE`
  );

  const dailySpendAmount = Number(todaySpend?.total_cost ?? 0);
  const dailyTaskCount = parseInt(todaySpend?.task_count ?? "0", 10);

  // 4. Monthly spend (current month)
  const monthlySpend = await queryOne<{ task_count: string; total_cost: string }>(
    `SELECT COUNT(*) as task_count,
            COALESCE(SUM(
              CASE
                WHEN te.cost_actual IS NOT NULL THEN te.cost_actual
                ELSE COALESCE(tc.cost_per_use, 0.10)
              END
            ), 0) as total_cost
     FROM task_queue tq
     LEFT JOIN tool_experiences te ON te.content_id = (tq.payload->>'content_id')
     LEFT JOIN tool_catalog tc ON tc.tool_name = tq.task_type
     WHERE tq.status = 'completed'
       AND tq.completed_at >= date_trunc('month', CURRENT_DATE)`
  );

  const monthlySpendAmount = Number(monthlySpend?.total_cost ?? 0);
  const monthlyTaskCount = parseInt(monthlySpend?.task_count ?? "0", 10);

  // 5. Daily spend breakdown (last 7 days)
  const dailyBreakdown = await query<{ date: string; task_count: string; total_cost: string }>(
    `SELECT DATE(tq.completed_at) as date,
            COUNT(*) as task_count,
            COALESCE(SUM(
              CASE
                WHEN te.cost_actual IS NOT NULL THEN te.cost_actual
                ELSE COALESCE(tc.cost_per_use, 0.10)
              END
            ), 0) as total_cost
     FROM task_queue tq
     LEFT JOIN tool_experiences te ON te.content_id = (tq.payload->>'content_id')
     LEFT JOIN tool_catalog tc ON tc.tool_name = tq.task_type
     WHERE tq.status = 'completed'
       AND tq.completed_at >= CURRENT_DATE - INTERVAL '7 days'
     GROUP BY DATE(tq.completed_at)
     ORDER BY date DESC`
  );

  const dailySpendHistory: DailySpend[] = dailyBreakdown.map((d) => ({
    date: d.date,
    task_count: parseInt(d.task_count, 10),
    estimated_cost: Number(d.total_cost),
  }));

  // 6. Recent completed tasks with cost
  const recentTasks = await query<{
    id: number;
    task_type: string;
    status: string;
    created_at: string;
    completed_at: string | null;
    payload: Record<string, unknown>;
    cost_actual: number | null;
    tool_cost: number | null;
  }>(
    `SELECT tq.id, tq.task_type, tq.status, tq.created_at, tq.completed_at,
            tq.payload,
            te.cost_actual,
            tc.cost_per_use as tool_cost
     FROM task_queue tq
     LEFT JOIN tool_experiences te ON te.content_id = (tq.payload->>'content_id')
     LEFT JOIN tool_catalog tc ON tc.tool_name = tq.task_type
     WHERE tq.status = 'completed'
     ORDER BY tq.completed_at DESC
     LIMIT 20`
  );

  const recentCosts: RecentTask[] = recentTasks.map((t) => {
    const contentId = (t.payload as Record<string, unknown>)?.content_id;
    const summary = contentId ? String(contentId) : t.task_type;
    return {
      id: t.id,
      task_type: t.task_type,
      status: t.status,
      created_at: t.created_at,
      completed_at: t.completed_at,
      payload_summary: summary,
      estimated_cost: Number(t.cost_actual ?? t.tool_cost ?? 0.10),
    };
  });

  // 7. Actual cost from tool_experiences (more accurate)
  const actualCostSummary = await queryOne<{ total: string; count: string }>(
    `SELECT COALESCE(SUM(cost_actual), 0) as total, COUNT(*) as count
     FROM tool_experiences
     WHERE created_at >= date_trunc('month', CURRENT_DATE)
       AND cost_actual IS NOT NULL`
  );

  return NextResponse.json({
    settings,
    summary: {
      daily_spend: dailySpendAmount,
      daily_task_count: dailyTaskCount,
      daily_budget: dailyBudget,
      daily_remaining: Math.max(0, dailyBudget - dailySpendAmount),
      monthly_spend: monthlySpendAmount,
      monthly_task_count: monthlyTaskCount,
      monthly_budget: monthlyBudget,
      monthly_remaining: Math.max(0, monthlyBudget - monthlySpendAmount),
      budget_utilization_percent:
        monthlyBudget > 0
          ? Math.round((monthlySpendAmount / monthlyBudget) * 100)
          : 0,
      alert_active:
        monthlyBudget > 0 &&
        (monthlySpendAmount / monthlyBudget) * 100 >= alertThreshold,
      actual_tracked_cost: Number(actualCostSummary?.total ?? 0),
      actual_tracked_count: parseInt(actualCostSummary?.count ?? "0", 10),
    },
    daily_history: dailySpendHistory,
    recent_tasks: recentCosts,
  });
}
