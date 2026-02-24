"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default function LearningsPage() {
  const [learnings, setLearnings] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/learnings")
      .then((res) => res.json())
      .then((data) => setLearnings(data.learnings || []))
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
      {learnings.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          データがありません
        </div>
      ) : (
        <div className="space-y-3">
          {learnings.map((l, i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <p>{l.insight as string}</p>
                <div className="flex gap-2 mt-1">
                  <Badge variant="secondary">{l.category as string}</Badge>
                  <span className="text-sm text-muted-foreground">
                    confidence: {String(l.confidence)}
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
