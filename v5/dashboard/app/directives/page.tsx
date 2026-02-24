"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface Directive {
  id: number;
  directive_type: string;
  content: string;
  target_agents: string[];
  status: string;
  priority: string;
  created_at: string;
}

export default function DirectivesPage() {
  const [directives, setDirectives] = useState<Directive[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDirectives = useCallback(() => {
    setLoading(true);
    fetch("/api/directives")
      .then((res) => res.json())
      .then((data) => setDirectives(data.directives || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchDirectives();
  }, [fetchDirectives]);

  if (loading)
    return (
      <div>
        <div role="progressbar">Loading...</div>
      </div>
    );

  return (
    <div>
      {directives.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          データがありません
        </div>
      ) : (
        <div className="space-y-3">
          {directives.map((d) => (
            <Card key={d.id}>
              <CardContent className="pt-4">
                <div className="flex justify-between">
                  <span className="font-semibold">{d.directive_type}</span>
                  <Badge
                    variant={d.status === "applied" ? "success" : "warning"}
                  >
                    {d.status}
                  </Badge>
                </div>
                <p className="mt-1">{d.content}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Priority: {d.priority}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
