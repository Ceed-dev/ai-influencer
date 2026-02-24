"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface KpiSummary {
  total_accounts: number;
  active_accounts: number;
  total_followers: number;
  avg_engagement_rate: number;
  monetizable_accounts: number;
  total_content: number;
  pending_review: number;
  published_count: number;
  total_views: number;
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

// Page: KPI Dashboard — <main> content provided by layout shell
export default function KpiDashboardPage() {
  const [kpi, setKpi] = useState<KpiSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/kpi/summary")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load KPI data");
        return res.json();
      })
      .then((data) => setKpi(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div>
        <div role="progressbar">Loading...</div>
      </div>
    );
  if (error)
    return (
      <div>
        <div className="text-destructive">エラー: {error}</div>
      </div>
    );

  return (
    <div>
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8"
        data-testid="kpi-cards"
      >
        <KpiCard label="総アカウント数" value={kpi?.total_accounts ?? 0} />
        <KpiCard label="アクティブアカウント数" value={kpi?.active_accounts ?? 0} />
        <KpiCard
          label="総フォロワー数"
          value={kpi?.total_followers?.toLocaleString() ?? 0}
        />
        <KpiCard
          label="平均エンゲージメント率"
          value={`${kpi?.avg_engagement_rate?.toFixed(2) ?? 0}%`}
        />
        <KpiCard
          label="収益化アカウント数"
          value={kpi?.monetizable_accounts ?? 0}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="総コンテンツ数" value={kpi?.total_content ?? 0} />
        <KpiCard label="レビュー待ち" value={kpi?.pending_review ?? 0} />
        <KpiCard label="公開済み" value={kpi?.published_count ?? 0} />
      </div>
    </div>
  );
}
