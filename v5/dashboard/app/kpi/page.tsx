"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/select";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { fetcher, swrConfig } from "@/lib/swr-config";

// Solarized palette
const COLORS = {
  blue: "#268bd2",
  cyan: "#2aa198",
  green: "#859900",
  yellow: "#b58900",
  red: "#dc322f",
  violet: "#6c71c4",
  magenta: "#d33682",
  orange: "#cb4b16",
};

interface KpiSummary {
  accounts: number;
  followers: {
    current: number;
    target: number;
    growth_rate: number;
  };
  engagement: {
    avg_rate: number;
    trend: string;
  };
  content: {
    total_produced: number;
    total_posted: number;
    total_measured: number;
  };
  monetization: {
    monetized_count: number;
    revenue_estimate: number;
  };
  prediction_accuracy: number | null;
}

interface KpiSnapshot {
  id: number;
  platform: string;
  year_month: string;
  kpi_target: number;
  avg_impressions: number;
  achievement_rate: number;
  account_count: number;
  publication_count: number;
  prediction_accuracy: number | null;
  is_reliable: boolean;
  calculated_at: string;
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

// Page: KPI Dashboard -- <main> content provided by layout shell
export default function KpiDashboardPage() {
  const [period, setPeriod] = useState<string>("30d");

  const { data: kpi, error: kpiError, isLoading: kpiLoading } = useSWR<KpiSummary>(
    `/api/kpi/summary?period=${period}`,
    fetcher,
    {
      refreshInterval: swrConfig.refreshInterval,
      revalidateOnFocus: swrConfig.revalidateOnFocus,
      dedupingInterval: swrConfig.dedupingInterval,
    }
  );

  const { data: snapshotData, isLoading: snapLoading } = useSWR<{
    snapshots: KpiSnapshot[];
  }>("/api/kpi/snapshots", fetcher, {
    refreshInterval: swrConfig.refreshInterval,
    revalidateOnFocus: swrConfig.revalidateOnFocus,
    dedupingInterval: swrConfig.dedupingInterval,
  });

  const loading = kpiLoading || snapLoading;
  const snapshots = snapshotData?.snapshots ?? [];

  if (loading)
    return (
      <div>
        <div role="progressbar">Loading...</div>
      </div>
    );
  if (kpiError)
    return (
      <div>
        <div className="text-destructive">
          エラー: {kpiError instanceof Error ? kpiError.message : "Failed to load KPI data"}
        </div>
      </div>
    );

  // Build trend data from snapshots grouped by year_month
  const trendMap = new Map<string, Record<string, unknown>>();
  for (const snap of snapshots) {
    const existing = trendMap.get(snap.year_month) || {
      month: snap.year_month,
    };
    existing[`${snap.platform}_impressions`] = Math.round(
      snap.avg_impressions
    );
    existing[`${snap.platform}_achievement`] = Math.round(
      snap.achievement_rate * 100
    );
    trendMap.set(snap.year_month, existing);
  }
  const trendData = Array.from(trendMap.values()).sort((a, b) =>
    (a.month as string).localeCompare(b.month as string)
  );

  // Build goal vs actual data from snapshots (latest month per platform)
  const latestByPlatform = new Map<string, KpiSnapshot>();
  for (const snap of snapshots) {
    const existing = latestByPlatform.get(snap.platform);
    if (!existing || snap.year_month > existing.year_month) {
      latestByPlatform.set(snap.platform, snap);
    }
  }
  const goalVsActualData = Array.from(latestByPlatform.values()).map(
    (snap) => ({
      platform: snap.platform,
      target: snap.kpi_target,
      actual: Math.round(snap.avg_impressions),
      achievement: Math.round(snap.achievement_rate * 100),
    })
  );

  const platformColors: Record<string, string> = {
    youtube: COLORS.red,
    tiktok: COLORS.cyan,
    instagram: COLORS.magenta,
    x: COLORS.blue,
  };

  const platforms = Array.from(
    new Set(snapshots.map((s) => s.platform))
  ).sort();

  return (
    <div>
      {/* Period selector */}
      <div className="flex items-center gap-3 mb-6">
        <label htmlFor="kpi-period" className="text-sm font-medium">
          期間
        </label>
        <NativeSelect
          id="kpi-period"
          className="w-auto"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="7d">7日間</option>
          <option value="30d">30日間</option>
          <option value="90d">90日間</option>
        </NativeSelect>
      </div>

      {/* KPI summary cards */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8"
        data-testid="kpi-cards"
      >
        <KpiCard label="総アカウント数" value={kpi?.accounts ?? 0} />
        <KpiCard label="アクティブアカウント数" value={kpi?.accounts ?? 0} />
        <KpiCard
          label="総フォロワー数"
          value={kpi?.followers?.current?.toLocaleString() ?? "0"}
        />
        <KpiCard
          label="フォロワー目標"
          value={kpi?.followers?.target?.toLocaleString() ?? "0"}
        />
        <KpiCard
          label="平均エンゲージメント率"
          value={`${kpi?.engagement?.avg_rate?.toFixed(2) ?? "0.00"}%`}
        />
        <KpiCard
          label="収益化アカウント数"
          value={kpi?.monetization?.monetized_count ?? 0}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="総コンテンツ数"
          value={kpi?.content?.total_produced ?? 0}
        />
        <KpiCard
          label="レビュー待ち"
          value={kpi?.content?.total_measured ?? 0}
        />
        <KpiCard
          label="公開済み"
          value={kpi?.content?.total_posted ?? 0}
        />
        <KpiCard
          label="予測精度"
          value={
            kpi?.prediction_accuracy != null
              ? `${(kpi.prediction_accuracy * 100).toFixed(1)}%`
              : "N/A"
          }
        />
      </div>

      {/* KPI trend chart */}
      {trendData.length > 0 && (
        <Card className="mb-8">
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">
              KPIトレンド (平均インプレッション)
            </h3>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <YAxis
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  tickFormatter={(v: number) => v.toLocaleString()}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    color: "var(--fg)",
                  }}
                  formatter={(value: number) => value.toLocaleString()}
                />
                <Legend />
                {platforms.map((platform) => (
                  <Line
                    key={platform}
                    type="monotone"
                    dataKey={`${platform}_impressions`}
                    name={`${platform} インプレッション`}
                    stroke={platformColors[platform] || COLORS.violet}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Goal vs Actual comparison */}
      {goalVsActualData.length > 0 && (
        <Card className="mb-8">
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">
              目標 vs 実績 (平均インプレッション)
            </h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={goalVsActualData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="platform"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <YAxis
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  tickFormatter={(v: number) => v.toLocaleString()}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    color: "var(--fg)",
                  }}
                  formatter={(value: number) => value.toLocaleString()}
                />
                <Legend />
                <Bar
                  dataKey="target"
                  name="目標"
                  fill={COLORS.blue}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="actual"
                  name="実績"
                  fill={COLORS.green}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Achievement rate trend */}
      {trendData.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">
              達成率トレンド (%)
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <YAxis
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  domain={[0, 100]}
                  unit="%"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    color: "var(--fg)",
                  }}
                  formatter={(value: number) => `${value}%`}
                />
                <Legend />
                {platforms.map((platform) => (
                  <Line
                    key={platform}
                    type="monotone"
                    dataKey={`${platform}_achievement`}
                    name={`${platform} 達成率`}
                    stroke={platformColors[platform] || COLORS.violet}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
