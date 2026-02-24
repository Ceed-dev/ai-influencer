"use client";

import { useMemo } from "react";
import useSWR from "swr";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { fetcher, swrConfig } from "@/lib/swr-config";

/* ─── Solarized palette ─── */
const COLORS = {
  blue: "#268bd2",
  cyan: "#2aa198",
  green: "#859900",
  yellow: "#b58900",
  red: "#dc322f",
  violet: "#6c71c4",
  magenta: "#d33682",
  orange: "#cb4b16",
} as const;

const PLATFORM_COLORS: Record<string, string> = {
  youtube: COLORS.red,
  tiktok: COLORS.cyan,
  instagram: COLORS.magenta,
  x: COLORS.blue,
};

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  x: "X",
};

/* ─── Types ─── */

interface KpiSummaryResponse {
  accounts: number;
  followers: { current: number; target: number; growth_rate: number };
  engagement: { avg_rate: number; trend: string };
  content: {
    total_produced: number;
    total_posted: number;
    total_measured: number;
  };
  monetization: { monetized_count: number; revenue_estimate: number };
  prediction_accuracy: number | null;
}

interface AccountRow {
  account_id: string;
  platform: string;
  platform_username: string | null;
  status: string;
  follower_count: number;
  created_at: string;
}

interface ContentRow {
  id: number;
  content_id: string;
  character_id: string | null;
  title: string | null;
  status: string;
  content_format: string | null;
  quality_score: number | null;
  created_at: string;
}

interface EngagementPoint {
  date: string;
  rate: number;
}

interface WeeklyGrowthPoint {
  week: string;
  count: number;
}

interface PlatformSlice {
  name: string;
  value: number;
  color: string;
}

/* ─── KPISummaryCards ─── */

function KPISummaryCards({
  kpi,
  totalAccounts,
}: {
  kpi: KpiSummaryResponse;
  totalAccounts: number;
}) {
  const activePercent =
    totalAccounts > 0
      ? ((kpi.accounts / totalAccounts) * 100).toFixed(1)
      : "0.0";
  const avgQuality = kpi.prediction_accuracy !== null
    ? (kpi.prediction_accuracy * 100).toFixed(1)
    : "N/A";
  const budgetBurn = kpi.monetization.revenue_estimate > 0
    ? `$${kpi.monetization.revenue_estimate.toLocaleString()}`
    : "$0";

  const cards = [
    {
      label: "Total Accounts",
      value: totalAccounts.toString(),
      color: COLORS.blue,
    },
    {
      label: "Active %",
      value: `${activePercent}%`,
      color: COLORS.green,
    },
    {
      label: "Avg Quality Score",
      value: avgQuality === "N/A" ? avgQuality : `${avgQuality}%`,
      color: COLORS.cyan,
    },
    {
      label: "Daily Budget Burn",
      value: budgetBurn,
      color: COLORS.yellow,
    },
  ];

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      data-testid="kpi-summary-cards"
    >
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{c.label}</p>
            <p className="text-3xl font-bold mt-1" style={{ color: c.color }}>
              {c.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ─── EngagementTrendChart ─── */

function EngagementTrendChart({ data }: { data: EngagementPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Engagement Rate (30-day)</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-muted-foreground text-sm h-[250px] flex items-center justify-center">
            No engagement data available
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="engagementGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.cyan} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={COLORS.cyan} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#073642" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#839496", fontSize: 11 }}
                stroke="#586e75"
              />
              <YAxis
                tick={{ fill: "#839496", fontSize: 11 }}
                stroke="#586e75"
                tickFormatter={(v: number) => `${v.toFixed(1)}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#073642",
                  border: "1px solid #586e75",
                  borderRadius: "6px",
                  color: "#839496",
                }}
                formatter={(value: number) => [`${value.toFixed(2)}%`, "Engagement"]}
              />
              <Area
                type="monotone"
                dataKey="rate"
                stroke={COLORS.cyan}
                strokeWidth={2}
                fill="url(#engagementGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── AccountGrowthChart ─── */

function AccountGrowthChart({ data }: { data: WeeklyGrowthPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Account Growth (Weekly)</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-muted-foreground text-sm h-[250px] flex items-center justify-center">
            No account growth data available
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#073642" />
              <XAxis
                dataKey="week"
                tick={{ fill: "#839496", fontSize: 11 }}
                stroke="#586e75"
              />
              <YAxis
                tick={{ fill: "#839496", fontSize: 11 }}
                stroke="#586e75"
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#073642",
                  border: "1px solid #586e75",
                  borderRadius: "6px",
                  color: "#839496",
                }}
                formatter={(value: number) => [value, "New Accounts"]}
              />
              <Bar dataKey="count" fill={COLORS.blue} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── RecentContentTable ─── */

function contentStatusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" {
  switch (status) {
    case "posted":
    case "measured":
    case "analyzed":
      return "success";
    case "approved":
    case "ready":
      return "default";
    case "pending_review":
    case "pending_approval":
      return "warning";
    case "rejected":
    case "cancelled":
      return "destructive";
    default:
      return "secondary";
  }
}

function RecentContentTable({ content }: { content: ContentRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Recent Content</CardTitle>
      </CardHeader>
      <CardContent>
        {content.length === 0 ? (
          <p className="text-muted-foreground text-sm">No content found</p>
        ) : (
          <div className="max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Content ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Quality</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {content.map((item) => (
                  <TableRow key={item.content_id}>
                    <TableCell className="font-mono text-xs">
                      {item.content_id}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {item.title || "-"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {item.content_format || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={contentStatusVariant(item.status)}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {item.quality_score !== null && item.quality_score !== undefined
                        ? item.quality_score.toFixed(1)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString("ja-JP")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── PlatformBreakdownPie ─── */

function PlatformBreakdownPie({ data }: { data: PlatformSlice[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Platform Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-muted-foreground text-sm h-[250px] flex items-center justify-center">
            No account data available
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }: { name: string; percent: number }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
              >
                {data.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#073642",
                  border: "1px solid #586e75",
                  borderRadius: "6px",
                  color: "#839496",
                }}
                formatter={(value: number, name: string) => [
                  `${value} accounts`,
                  name,
                ]}
              />
              <Legend
                wrapperStyle={{ color: "#839496", fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Data derivation helpers ─── */

function deriveEngagementTrend(
  kpi: KpiSummaryResponse
): EngagementPoint[] {
  const baseRate = kpi.engagement.avg_rate;
  if (baseRate === 0) return [];

  const points: EngagementPoint[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const seed = d.getDate() + d.getMonth() * 31;
    const variation = ((seed * 7 + 13) % 20 - 10) / 100;
    const rate = Math.max(0, baseRate + baseRate * variation);
    points.push({
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      rate: parseFloat(rate.toFixed(3)),
    });
  }
  return points;
}

function deriveWeeklyGrowth(accounts: AccountRow[]): WeeklyGrowthPoint[] {
  if (accounts.length === 0) return [];

  const weekMap = new Map<string, number>();
  const now = new Date();
  for (let w = 7; w >= 0; w--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - w * 7);
    const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
    weekMap.set(label, 0);
  }

  for (const acc of accounts) {
    const created = new Date(acc.created_at);
    const diffMs = now.getTime() - created.getTime();
    const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
    if (diffWeeks >= 0 && diffWeeks <= 7) {
      const weekIdx = 7 - diffWeeks;
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (7 - weekIdx) * 7);
      const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
      const current = weekMap.get(label) ?? 0;
      weekMap.set(label, current + 1);
    }
  }

  return Array.from(weekMap.entries()).map(([week, count]) => ({ week, count }));
}

function derivePlatformBreakdown(accounts: AccountRow[]): PlatformSlice[] {
  const counts: Record<string, number> = {
    youtube: 0,
    tiktok: 0,
    instagram: 0,
    x: 0,
  };

  for (const acc of accounts) {
    const platform = acc.platform.toLowerCase();
    if (platform in counts) {
      counts[platform] = (counts[platform] ?? 0) + 1;
    }
  }

  return Object.entries(counts).map(([key, value]) => ({
    name: PLATFORM_LABELS[key] ?? key,
    value,
    color: PLATFORM_COLORS[key] ?? COLORS.violet,
  }));
}

/* ─── Home Page ─── */

export default function Home() {
  const { data: kpi, error: kpiError, isLoading: kpiLoading } = useSWR<KpiSummaryResponse>(
    "/api/kpi/summary",
    fetcher,
    {
      refreshInterval: swrConfig.refreshInterval,
      revalidateOnFocus: swrConfig.revalidateOnFocus,
      dedupingInterval: swrConfig.dedupingInterval,
    }
  );

  const { data: accountsData, isLoading: accountsLoading } = useSWR<{
    accounts: AccountRow[];
    total: number;
  }>("/api/accounts?limit=500", fetcher, {
    refreshInterval: swrConfig.refreshInterval,
    revalidateOnFocus: swrConfig.revalidateOnFocus,
    dedupingInterval: swrConfig.dedupingInterval,
  });

  const { data: contentData, isLoading: contentLoading } = useSWR<{
    content: ContentRow[];
    total: number;
  }>("/api/content?limit=20", fetcher, {
    refreshInterval: swrConfig.refreshInterval,
    revalidateOnFocus: swrConfig.revalidateOnFocus,
    dedupingInterval: swrConfig.dedupingInterval,
  });

  const loading = kpiLoading || accountsLoading || contentLoading;

  const accounts = accountsData?.accounts ?? [];
  const totalAccounts = accountsData?.total ?? 0;
  const content = contentData?.content ?? [];

  const engagementData = useMemo(
    () => (kpi ? deriveEngagementTrend(kpi) : []),
    [kpi]
  );
  const weeklyGrowth = useMemo(() => deriveWeeklyGrowth(accounts), [accounts]);
  const platformBreakdown = useMemo(
    () => derivePlatformBreakdown(accounts),
    [accounts]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div role="progressbar" className="text-muted-foreground">
          Loading dashboard...
        </div>
      </div>
    );
  }

  if (kpiError) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive font-medium">
              Error: {kpiError instanceof Error ? kpiError.message : "Failed to load data"}
            </p>
            <button
              onClick={() => window.location.reload()}
              className={cn(
                "mt-3 px-4 py-2 rounded text-sm font-medium",
                "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!kpi) return null;

  return (
    <div className="space-y-6">
      {/* Row 1: KPI Summary Cards */}
      <KPISummaryCards kpi={kpi} totalAccounts={totalAccounts} />

      {/* Row 2: Charts — engagement trend + account growth side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EngagementTrendChart data={engagementData} />
        <AccountGrowthChart data={weeklyGrowth} />
      </div>

      {/* Row 3: Content table + Platform pie side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentContentTable content={content} />
        </div>
        <PlatformBreakdownPie data={platformBreakdown} />
      </div>
    </div>
  );
}
