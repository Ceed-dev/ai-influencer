"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";

export default function CharactersPage() {
  const [characters, setCharacters] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/accounts")
      .then((res) => res.json())
      .then(() => setCharacters([]))
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
      {characters.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              データがありません
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {characters.map((c, i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                {c.name as string}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
