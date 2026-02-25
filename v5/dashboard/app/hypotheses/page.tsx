"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/select";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
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

const VERDICT_COLORS: Record<string, string> = {
  pending: COLORS.yellow,
  confirmed: COLORS.green,
  rejected: COLORS.red,
  inconclusive: COLORS.violet,
};

interface Hypothesis {
  id: number;
  hypothesis: string;
  category: string;
  verdict: string;
  confidence: number;
  created_at: string;
  tested_at: string | null;
}

export default function HypothesesPage() {
  const { t } = useTranslation();
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [loading, setLoading] = useState(true);
  const [verdictFilter, setVerdictFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const fetchData = useCallback(() => {
    const params = new URLSearchParams();
    if (verdictFilter) params.set("verdict", verdictFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    params.set("limit", "200");

    setLoading(true);
    fetch(`/api/hypotheses?${params}`)
      .then((res) => res.json())
      .then((data) => setHypotheses((data.hypotheses || []) as Hypothesis[]))
      .finally(() => setLoading(false));
  }, [verdictFilter, categoryFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derive categories from full dataset
  const categories = Array.from(
    new Set(hypotheses.map((h) => h.category).filter(Boolean))
  ).sort();

  // Verdict distribution for pie chart
  const verdictCounts = hypotheses.reduce(
    (acc, h) => {
      const v = h.verdict || "pending";
      acc[v] = (acc[v] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const verdictPieData = Object.entries(verdictCounts).map(
    ([name, value]) => ({
      name,
      value,
    })
  );

  // Accuracy over time: group by month, compute confirmed ratio
  const monthlyMap = new Map<
    string,
    { total: number; confirmed: number; rejected: number }
  >();
  for (const h of hypotheses) {
    if (!h.created_at) continue;
    const month = h.created_at.slice(0, 7); // YYYY-MM
    const existing = monthlyMap.get(month) || {
      total: 0,
      confirmed: 0,
      rejected: 0,
    };
    existing.total++;
    if (h.verdict === "confirmed") existing.confirmed++;
    if (h.verdict === "rejected") existing.rejected++;
    monthlyMap.set(month, existing);
  }
  const accuracyData = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, counts]) => ({
      month,
      accuracy:
        counts.total > 0
          ? Math.round((counts.confirmed / counts.total) * 100)
          : 0,
      total: counts.total,
      confirmed: counts.confirmed,
      rejected: counts.rejected,
    }));

  if (loading)
    return (
      <div>
        <div role="progressbar">{t("common.loading")}</div>
      </div>
    );

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <label htmlFor="verdict-filter" className="text-sm font-medium">
            {t("hypotheses.verdict")}
          </label>
          <NativeSelect
            id="verdict-filter"
            className="w-auto"
            value={verdictFilter}
            onChange={(e) => setVerdictFilter(e.target.value)}
          >
            <option value="">{t("common.all")}</option>
            <option value="pending">{t("hypotheses.pending")}</option>
            <option value="confirmed">{t("hypotheses.confirmed")}</option>
            <option value="rejected">{t("hypotheses.rejected")}</option>
            <option value="inconclusive">{t("hypotheses.inconclusive")}</option>
          </NativeSelect>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="category-filter" className="text-sm font-medium">
            {t("hypotheses.category")}
          </label>
          <NativeSelect
            id="category-filter"
            className="w-auto"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">{t("common.all")}</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </NativeSelect>
        </div>
        <span className="text-sm text-muted-foreground">
          {`${hypotheses.length} ${t("common.items")}`}
        </span>
      </div>

      {/* Charts */}
      {hypotheses.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          {/* Accuracy over time */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">
                {t("hypotheses.accuracyTrend")}
              </h3>
              {accuracyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={accuracyData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                    />
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
                      formatter={(value: number, name: string) => {
                        if (name === t("hypotheses.confirmationRate")) return `${value}%`;
                        return value;
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="accuracy"
                      name={t("hypotheses.confirmationRate")}
                      stroke={COLORS.green}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      name={t("hypotheses.totalHypotheses")}
                      stroke={COLORS.blue}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {t("hypotheses.noTimeSeriesData")}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Verdict distribution pie chart */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">{t("hypotheses.verdictDistribution")}</h3>
              {verdictPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={verdictPieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {verdictPieData.map((entry) => (
                        <Cell
                          key={`cell-${entry.name}`}
                          fill={VERDICT_COLORS[entry.name] || COLORS.violet}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        color: "var(--fg)",
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {t("hypotheses.noDistributionData")}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Card list */}
      {hypotheses.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t("common.noData")}
        </div>
      ) : (
        <div className="space-y-3">
          {hypotheses.map((h) => (
            <Card key={h.id}>
              <CardContent className="pt-4">
                <p className="font-semibold">{h.hypothesis}</p>
                <div className="flex gap-2 mt-1">
                  <Badge variant="secondary">{h.category}</Badge>
                  <Badge variant="outline">{h.verdict}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
