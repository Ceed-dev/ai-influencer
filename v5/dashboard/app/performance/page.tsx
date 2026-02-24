"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Cell,
} from "recharts";

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

const PLATFORM_COLORS: Record<string, string> = {
  youtube: COLORS.red,
  tiktok: COLORS.cyan,
  instagram: COLORS.magenta,
  x: COLORS.blue,
};

const BAR_PALETTE = [
  COLORS.blue,
  COLORS.cyan,
  COLORS.green,
  COLORS.yellow,
  COLORS.red,
  COLORS.violet,
  COLORS.magenta,
  COLORS.orange,
  "#268bd2",
  "#2aa198",
];

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

  if (loading)
    return (
      <div>
        <div role="progressbar">Loading...</div>
      </div>
    );

  // Top 10 accounts by followers
  const top10Followers = [...data]
    .sort((a, b) => (b.follower_count || 0) - (a.follower_count || 0))
    .slice(0, 10)
    .map((d) => ({
      name:
        d.platform_username.length > 12
          ? d.platform_username.slice(0, 12) + "..."
          : d.platform_username,
      fullName: d.platform_username,
      followers: d.follower_count || 0,
      platform: d.platform,
    }));

  // Engagement rate data (all accounts sorted by engagement rate)
  const engagementData = [...data]
    .filter((d) => d.engagement_rate > 0)
    .sort((a, b) => b.engagement_rate - a.engagement_rate)
    .slice(0, 15)
    .map((d) => ({
      name:
        d.platform_username.length > 12
          ? d.platform_username.slice(0, 12) + "..."
          : d.platform_username,
      fullName: d.platform_username,
      engagement_rate: d.engagement_rate,
      platform: d.platform,
    }));

  return (
    <div>
      {/* Charts section */}
      {data.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          {/* Engagement rate by account */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">
                エンゲージメント率 (上位15アカウント)
              </h3>
              {engagementData.length > 0 ? (
                <ResponsiveContainer width="100%" height={360}>
                  <LineChart data={engagementData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                      angle={-30}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                      unit="%"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        color: "var(--fg)",
                      }}
                      formatter={(value: number) => `${value}%`}
                      labelFormatter={(_label, payload) => {
                        const item = payload?.[0]?.payload as
                          | { fullName: string; platform: string }
                          | undefined;
                        return item
                          ? `${item.fullName} (${item.platform})`
                          : "";
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="engagement_rate"
                      name="エンゲージメント率"
                      stroke={COLORS.green}
                      strokeWidth={2}
                      dot={(props: Record<string, unknown>) => {
                        const { cx, cy, payload } = props as {
                          cx: number;
                          cy: number;
                          payload: { platform: string };
                        };
                        return (
                          <circle
                            key={`dot-${cx}-${cy}`}
                            cx={cx}
                            cy={cy}
                            r={5}
                            fill={
                              PLATFORM_COLORS[payload.platform] || COLORS.violet
                            }
                            stroke="none"
                          />
                        );
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  エンゲージメントデータなし
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top 10 by followers */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">
                フォロワー数 TOP 10
              </h3>
              {top10Followers.length > 0 ? (
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={top10Followers} layout="vertical">
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                    />
                    <XAxis
                      type="number"
                      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                      tickFormatter={(v: number) => v.toLocaleString()}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        color: "var(--fg)",
                      }}
                      formatter={(value: number) => value.toLocaleString()}
                      labelFormatter={(_label, payload) => {
                        const item = payload?.[0]?.payload as
                          | { fullName: string; platform: string }
                          | undefined;
                        return item
                          ? `${item.fullName} (${item.platform})`
                          : "";
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="followers"
                      name="フォロワー数"
                      radius={[0, 4, 4, 0]}
                    >
                      {top10Followers.map((entry, index) => (
                        <Cell
                          key={`cell-${entry.name}`}
                          fill={BAR_PALETTE[index % BAR_PALETTE.length]!}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  フォロワーデータなし
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      {data.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          データがありません
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>アカウント</TableHead>
              <TableHead>プラットフォーム</TableHead>
              <TableHead className="text-right">フォロワー</TableHead>
              <TableHead className="text-right">総ビュー</TableHead>
              <TableHead className="text-right">いいね</TableHead>
              <TableHead className="text-right">コメント</TableHead>
              <TableHead className="text-right">投稿数</TableHead>
              <TableHead className="text-right">エンゲージメント率</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.account_id}>
                <TableCell>{item.platform_username}</TableCell>
                <TableCell>{item.platform}</TableCell>
                <TableCell className="text-right font-mono">
                  {(item.follower_count || 0).toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {(item.total_views || 0).toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {(item.total_likes || 0).toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {(item.total_comments || 0).toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {item.publication_count}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {item.engagement_rate}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
