"use client";

import { useState, useEffect } from "react";

interface PerformanceEntry {
  account_id: string;
  platform: string;
  platform_username: string;
  follower_count: number;
  status: string;
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  publication_count: number;
  engagement_rate: number;
}

export default function PerformancePage() {
  const [data, setData] = useState<PerformanceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/performance")
      .then((res) => res.json())
      .then((d) => setData(d.performance || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <main className="p-6"><div role="progressbar">Loading...</div></main>;

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-6">Performance</h1>

      {data.length === 0 ? (
        <div className="text-center py-8 text-[var(--muted)]">データがありません</div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left p-2">アカウント</th>
              <th className="text-left p-2">プラットフォーム</th>
              <th className="text-right p-2">フォロワー</th>
              <th className="text-right p-2">総ビュー</th>
              <th className="text-right p-2">いいね</th>
              <th className="text-right p-2">コメント</th>
              <th className="text-right p-2">投稿数</th>
              <th className="text-right p-2">エンゲージメント率</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.account_id} className="border-b border-[var(--border)] hover:bg-[var(--sidebar-bg)]">
                <td className="p-2">{item.platform_username}</td>
                <td className="p-2">{item.platform}</td>
                <td className="p-2 text-right">{(item.follower_count || 0).toLocaleString()}</td>
                <td className="p-2 text-right">{(item.total_views || 0).toLocaleString()}</td>
                <td className="p-2 text-right">{(item.total_likes || 0).toLocaleString()}</td>
                <td className="p-2 text-right">{(item.total_comments || 0).toLocaleString()}</td>
                <td className="p-2 text-right">{item.publication_count}</td>
                <td className="p-2 text-right">{item.engagement_rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
