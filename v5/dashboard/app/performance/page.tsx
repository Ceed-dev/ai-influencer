"use client";

import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

  return (
    <div>
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
