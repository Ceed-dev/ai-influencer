"use client";

import { useState, useEffect } from "react";

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

  if (loading) return <main className="p-6"><div role="progressbar">Loading...</div></main>;
  if (error) return <main className="p-6"><div className="text-[var(--error)]">エラー: {error}</div></main>;

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-6">KPI Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8" data-testid="kpi-cards">
        <div className="p-4 rounded-lg bg-[var(--card-bg)] border border-[var(--border)]">
          <p className="text-sm text-[var(--muted)]">総アカウント数</p>
          <p className="text-2xl font-bold">{kpi?.total_accounts ?? 0}</p>
        </div>
        <div className="p-4 rounded-lg bg-[var(--card-bg)] border border-[var(--border)]">
          <p className="text-sm text-[var(--muted)]">アクティブアカウント数</p>
          <p className="text-2xl font-bold">{kpi?.active_accounts ?? 0}</p>
        </div>
        <div className="p-4 rounded-lg bg-[var(--card-bg)] border border-[var(--border)]">
          <p className="text-sm text-[var(--muted)]">総フォロワー数</p>
          <p className="text-2xl font-bold">{kpi?.total_followers?.toLocaleString() ?? 0}</p>
        </div>
        <div className="p-4 rounded-lg bg-[var(--card-bg)] border border-[var(--border)]">
          <p className="text-sm text-[var(--muted)]">平均エンゲージメント率</p>
          <p className="text-2xl font-bold">{kpi?.avg_engagement_rate?.toFixed(2) ?? 0}%</p>
        </div>
        <div className="p-4 rounded-lg bg-[var(--card-bg)] border border-[var(--border)]">
          <p className="text-sm text-[var(--muted)]">収益化アカウント数</p>
          <p className="text-2xl font-bold">{kpi?.monetizable_accounts ?? 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-[var(--card-bg)] border border-[var(--border)]">
          <p className="text-sm text-[var(--muted)]">総コンテンツ数</p>
          <p className="text-2xl font-bold">{kpi?.total_content ?? 0}</p>
        </div>
        <div className="p-4 rounded-lg bg-[var(--card-bg)] border border-[var(--border)]">
          <p className="text-sm text-[var(--muted)]">レビュー待ち</p>
          <p className="text-2xl font-bold">{kpi?.pending_review ?? 0}</p>
        </div>
        <div className="p-4 rounded-lg bg-[var(--card-bg)] border border-[var(--border)]">
          <p className="text-sm text-[var(--muted)]">公開済み</p>
          <p className="text-2xl font-bold">{kpi?.published_count ?? 0}</p>
        </div>
      </div>
    </main>
  );
}
