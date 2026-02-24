"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default function HypothesesPage() {
  const [hypotheses, setHypotheses] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/hypotheses")
      .then((res) => res.json())
      .then((data) => setHypotheses(data.hypotheses || []))
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
      {hypotheses.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          データがありません
        </div>
      ) : (
        <div className="space-y-3">
          {hypotheses.map((h, i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <p className="font-semibold">{h.hypothesis as string}</p>
                <div className="flex gap-2 mt-1">
                  <Badge variant="secondary">{h.category as string}</Badge>
                  <Badge variant="outline">{h.verdict as string}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
