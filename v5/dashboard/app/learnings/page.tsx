"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n";
import {
  BarChart,
  Bar,
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

const PIE_PALETTE = [
  COLORS.blue,
  COLORS.cyan,
  COLORS.green,
  COLORS.yellow,
  COLORS.red,
  COLORS.violet,
  COLORS.magenta,
  COLORS.orange,
];

interface Learning {
  id: number;
  insight: string;
  category: string;
  confidence: number;
  created_at: string;
}

const CONFIDENCE_BUCKETS = [
  { label: "0.0-0.2", min: 0, max: 0.2 },
  { label: "0.2-0.4", min: 0.2, max: 0.4 },
  { label: "0.4-0.6", min: 0.4, max: 0.6 },
  { label: "0.6-0.8", min: 0.6, max: 0.8 },
  { label: "0.8-1.0", min: 0.8, max: 1.01 },
];

export default function LearningsPage() {
  const { t } = useTranslation();
  const [learnings, setLearnings] = useState<Learning[]>([]);
  const [loading, setLoading] = useState(true);
  const [minConfidence, setMinConfidence] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const fetchData = useCallback(() => {
    const params = new URLSearchParams();
    if (minConfidence) params.set("min_confidence", minConfidence);
    if (categoryFilter) params.set("category", categoryFilter);
    params.set("limit", "200");

    setLoading(true);
    fetch(`/api/learnings?${params}`)
      .then((res) => res.json())
      .then((data) => setLearnings((data.learnings || []) as Learning[]))
      .finally(() => setLoading(false));
  }, [minConfidence, categoryFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derive categories
  const categories = Array.from(
    new Set(learnings.map((l) => l.category).filter(Boolean))
  ).sort();

  // Confidence distribution histogram
  const histogramData = CONFIDENCE_BUCKETS.map((bucket) => ({
    range: bucket.label,
    count: learnings.filter(
      (l) => l.confidence >= bucket.min && l.confidence < bucket.max
    ).length,
  }));

  // Category distribution for pie chart
  const categoryCounts = learnings.reduce(
    (acc, l) => {
      const cat = l.category || "unknown";
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const categoryPieData = Object.entries(categoryCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

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
          <label htmlFor="confidence-filter" className="text-sm font-medium">
            {t("learnings.minConfidence")}
          </label>
          <NativeSelect
            id="confidence-filter"
            className="w-auto"
            value={minConfidence}
            onChange={(e) => setMinConfidence(e.target.value)}
          >
            <option value="">{t("common.all")}</option>
            <option value="0.2">0.2+</option>
            <option value="0.4">0.4+</option>
            <option value="0.6">0.6+</option>
            <option value="0.8">0.8+</option>
          </NativeSelect>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="learning-category" className="text-sm font-medium">
            {t("learnings.category")}
          </label>
          <NativeSelect
            id="learning-category"
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
          {learnings.length} {t("common.items")}
        </span>
      </div>

      {/* Charts */}
      {learnings.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          {/* Confidence histogram */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">
                {t("learnings.confidenceDistribution")}
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={histogramData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                  />
                  <XAxis
                    dataKey="range"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    label={{
                      value: t("learnings.confidenceAxis"),
                      position: "insideBottom",
                      offset: -5,
                      fill: "var(--muted-foreground)",
                    }}
                  />
                  <YAxis
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    label={{
                      value: t("learnings.countAxis"),
                      angle: -90,
                      position: "insideLeft",
                      fill: "var(--muted-foreground)",
                    }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      color: "var(--fg)",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    name={t("learnings.count")}
                    fill={COLORS.blue}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Category distribution pie chart */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">{t("learnings.categoryDistribution")}</h3>
              {categoryPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryPieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {categoryPieData.map((entry, index) => (
                        <Cell
                          key={`cell-${entry.name}`}
                          fill={PIE_PALETTE[index % PIE_PALETTE.length]!}
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
                  {t("learnings.noCategoryData")}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Card list */}
      {learnings.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t("common.noData")}
        </div>
      ) : (
        <div className="space-y-3">
          {learnings.map((l) => (
            <Card key={l.id}>
              <CardContent className="pt-4">
                <p>{l.insight}</p>
                <div className="flex gap-2 mt-1">
                  <Badge variant="secondary">{l.category}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {t("common.confidence")}: {String(l.confidence)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
