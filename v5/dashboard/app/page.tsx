import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>AI Influencer Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">v5.0 Management Console</p>
        </CardContent>
      </Card>
    </div>
  );
}
