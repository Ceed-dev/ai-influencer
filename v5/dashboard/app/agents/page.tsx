"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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

const AGENT_COLORS: Record<string, string> = {
  strategist: COLORS.blue,
  researcher: COLORS.cyan,
  analyst: COLORS.green,
  planner: COLORS.yellow,
  tool_specialist: COLORS.violet,
  data_curator: COLORS.magenta,
};

const AGENT_TYPES = [
  "strategist",
  "researcher",
  "analyst",
  "planner",
  "tool_specialist",
  "data_curator",
];

const AGENT_LABELS: Record<string, string> = {
  strategist: "戦略Agent",
  researcher: "リサーチャー",
  analyst: "アナリスト",
  planner: "プランナー",
  tool_specialist: "ツールSP",
  data_curator: "キュレーター",
};

export default function AgentsPage() {
  return (
    <div>
      <Tabs defaultValue="thought-log">
        <TabsList className="mb-6">
          <TabsTrigger value="thought-log">思考ログ</TabsTrigger>
          <TabsTrigger value="dialogue">対話</TabsTrigger>
          <TabsTrigger value="evolution">進化</TabsTrigger>
          <TabsTrigger value="prompt">プロンプト管理</TabsTrigger>
          <TabsTrigger value="suggestions">改善提案</TabsTrigger>
          <TabsTrigger value="growth">個別成長</TabsTrigger>
          <TabsTrigger value="inbox">受信トレイ</TabsTrigger>
        </TabsList>

        <TabsContent value="thought-log">
          <ThoughtLogPanel />
        </TabsContent>
        <TabsContent value="dialogue">
          <DialoguePanel />
        </TabsContent>
        <TabsContent value="evolution">
          <EvolutionPanel />
        </TabsContent>
        <TabsContent value="prompt">
          <PromptPanel />
        </TabsContent>
        <TabsContent value="suggestions">
          <SuggestionsPanel />
        </TabsContent>
        <TabsContent value="growth">
          <GrowthPanel />
        </TabsContent>
        <TabsContent value="inbox">
          <InboxPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ThoughtLogPanel() {
  const [agentType, setAgentType] = useState("");
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = () => {
    const params = new URLSearchParams();
    if (agentType) params.set("agent_type", agentType);
    fetch(`/api/thought-logs?${params}`)
      .then((res) => res.json())
      .then((d) => setLogs(d.logs || []));
  };

  useState(() => {
    fetchLogs();
  });

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <label htmlFor="agent-filter">エージェント</label>
        <NativeSelect
          id="agent-filter"
          className="w-auto"
          value={agentType}
          onChange={(e) => {
            setAgentType(e.target.value);
            setTimeout(fetchLogs, 0);
          }}
        >
          <option value="">全て</option>
          {AGENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {AGENT_LABELS[t] || t}
            </option>
          ))}
        </NativeSelect>
      </div>
      {logs.map((log) => (
        <Card
          key={log.id as string}
          data-log-entry
          data-agent-type={log.agent_type as string}
          className="mb-2 cursor-pointer"
          onClick={() =>
            setExpandedId(
              expandedId === (log.id as string) ? null : (log.id as string)
            )
          }
        >
          <CardContent className="pt-4">
            <div className="flex justify-between">
              <span className="font-semibold">
                {log.node_name as string}
              </span>
              <span className="text-sm text-muted-foreground">
                {log.agent_type as string} | Cycle{" "}
                {log.cycle_id as number}
              </span>
            </div>
            <p className="text-sm mt-1 truncate">{log.decision as string}</p>
            {expandedId === (log.id as string) && (
              <div className="mt-3 space-y-2 text-sm">
                <div>
                  <strong>読み取りデータ (input_data)</strong>:{" "}
                  <pre className="bg-background p-2 rounded mt-1 overflow-auto">
                    {JSON.stringify(log.input_summary, null, 2)}
                  </pre>
                </div>
                <div>
                  <strong>考慮事項 (reasoning)</strong>:{" "}
                  <p className="mt-1">{log.reasoning as string}</p>
                </div>
                <div>
                  <strong>判断 (output)</strong>:{" "}
                  <p className="mt-1">{log.decision as string}</p>
                </div>
                {(log.tools_used as string[])?.length > 0 && (
                  <div>
                    <strong>MCP Tools</strong>:{" "}
                    {(log.tools_used as string[]).join(", ")}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      {logs.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          データがありません
        </div>
      )}
    </div>
  );
}

function DialoguePanel() {
  const [selectedAgent, setSelectedAgent] = useState("strategist");
  const [messages, setMessages] = useState<Record<string, unknown>[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [priority, setPriority] = useState("normal");

  const fetchMessages = () => {
    fetch(`/api/communications?agent_type=${selectedAgent}`)
      .then((res) => res.json())
      .then((d) => setMessages(d.messages || []));
  };

  useState(() => {
    fetchMessages();
  });

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    await fetch("/api/communications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_type: selectedAgent,
        message_type: "status_report",
        priority,
        content: newMessage,
      }),
    });
    setNewMessage("");
    fetchMessages();
  };

  return (
    <div className="flex gap-4">
      <div className="w-48 space-y-1">
        {AGENT_TYPES.map((t) => (
          <Button
            key={t}
            variant={selectedAgent === t ? "default" : "ghost"}
            size="sm"
            className="w-full justify-start"
            onClick={() => {
              setSelectedAgent(t);
              setTimeout(fetchMessages, 0);
            }}
          >
            {AGENT_LABELS[t]}
          </Button>
        ))}
      </div>
      <div className="flex-1">
        <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
          {messages.map((msg) => (
            <Card
              key={msg.id as string}
              data-status={msg.status as string}
            >
              <CardContent className="pt-3 pb-3">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">
                    {msg.message_type as string}
                  </span>
                  <Badge
                    variant={
                      msg.status === "responded"
                        ? "success"
                        : msg.status === "unread"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {msg.status === "applied"
                      ? "適用済み"
                      : msg.status === "pending"
                      ? "保留中"
                      : (msg.status as string)}
                  </Badge>
                </div>
                <p className="mt-1">{msg.content as string}</p>
                {msg.human_response ? (
                  <p className="mt-1 text-sm text-[var(--accent-cyan)]">
                    返信: {msg.human_response as string}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
          {messages.length === 0 && (
            <div className="text-center py-4 text-muted-foreground">
              メッセージなし
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="指示を入力"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1"
          />
          <NativeSelect
            aria-label="優先度"
            className="w-auto"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="low">low</option>
            <option value="normal">normal</option>
            <option value="high">high</option>
            <option value="urgent">urgent</option>
          </NativeSelect>
          <Button onClick={sendMessage}>送信</Button>
        </div>
      </div>
    </div>
  );
}

function EvolutionPanel() {
  const [reflections, setReflections] = useState<Record<string, unknown>[]>(
    []
  );

  useState(() => {
    fetch("/api/reflections?limit=200")
      .then((res) => res.json())
      .then((d) => setReflections(d.reflections || []));
  });

  const agentGroups = AGENT_TYPES.reduce((acc, t) => {
    acc[t] = reflections
      .filter((r) => r.agent_type === t)
      .sort((a, b) => (a.cycle_id as number) - (b.cycle_id as number));
    return acc;
  }, {} as Record<string, Record<string, unknown>[]>);

  // Latest self_score per agent for the bar chart
  const latestScores = AGENT_TYPES.map((t) => {
    const data = agentGroups[t] || [];
    const latest = data.length > 0 ? data[data.length - 1] : null;
    return {
      agent: AGENT_LABELS[t] || t,
      agent_type: t,
      self_score: latest ? (latest.self_score as number) : 0,
    };
  }).filter((d) => d.self_score > 0);

  // Build line chart data: pivot by cycle_id with agents as columns
  const cycleMap = new Map<number, Record<string, unknown>>();
  for (const t of AGENT_TYPES) {
    const data = agentGroups[t] || [];
    for (const r of data) {
      const cycleId = r.cycle_id as number;
      const existing = cycleMap.get(cycleId) || { cycle: cycleId };
      existing[t] = r.self_score as number;
      cycleMap.set(cycleId, existing);
    }
  }
  const progressionData = Array.from(cycleMap.values()).sort(
    (a, b) => (a.cycle as number) - (b.cycle as number)
  );

  // Determine which agents actually have data
  const activeAgents = AGENT_TYPES.filter(
    (t) => (agentGroups[t] || []).length > 0
  );

  return (
    <div>
      {/* Bar chart: current self_score per agent */}
      {latestScores.length > 0 && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">
              エージェント別 self_score (最新)
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={latestScores}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                />
                <XAxis
                  dataKey="agent"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <YAxis
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  domain={[0, 10]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    color: "var(--fg)",
                  }}
                />
                <Bar dataKey="self_score" name="self_score" radius={[4, 4, 0, 0]}>
                  {latestScores.map((entry) => (
                    <Cell
                      key={`bar-${entry.agent_type}`}
                      fill={AGENT_COLORS[entry.agent_type] || COLORS.violet}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Line chart: self_score progression over cycles */}
      {progressionData.length > 1 && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">
              self_score 推移 (サイクル別)
            </h3>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={progressionData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                />
                <XAxis
                  dataKey="cycle"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  label={{
                    value: "サイクル",
                    position: "insideBottom",
                    offset: -5,
                    fill: "var(--muted-foreground)",
                  }}
                />
                <YAxis
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  domain={[0, 10]}
                  label={{
                    value: "self_score",
                    angle: -90,
                    position: "insideLeft",
                    fill: "var(--muted-foreground)",
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    color: "var(--fg)",
                  }}
                />
                <Legend />
                {activeAgents.map((t) => (
                  <Line
                    key={t}
                    type="monotone"
                    dataKey={t}
                    name={AGENT_LABELS[t] || t}
                    stroke={AGENT_COLORS[t] || COLORS.violet}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Individual agent detail cards (legacy section, simplified) */}
      {AGENT_TYPES.map((t) => {
        const data = agentGroups[t] || [];
        if (data.length === 0) return null;
        const latest = data[data.length - 1]!;
        return (
          <Card key={t} className="mb-4">
            <CardContent className="pt-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">
                  {AGENT_LABELS[t]}
                </h3>
                <Badge variant="secondary">
                  {data.length} リフレクション
                </Badge>
              </div>
              <div className="mt-2 text-sm space-y-1">
                <p>
                  最新 self_score:{" "}
                  <strong>{latest.self_score as number}</strong> (Cycle{" "}
                  {latest.cycle_id as number})
                </p>
                {(latest.what_went_well as string) ? (
                  <p className="text-muted-foreground">
                    良かった点: {latest.what_went_well as string}
                  </p>
                ) : null}
                {(latest.what_to_improve as string) ? (
                  <p className="text-muted-foreground">
                    改善点: {latest.what_to_improve as string}
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        );
      })}
      {reflections.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          データがありません
        </div>
      )}
    </div>
  );
}

function PromptPanel() {
  const [agentType, setAgentType] = useState("strategist");
  const [versions, setVersions] = useState<Record<string, unknown>[]>([]);

  const fetchVersions = () => {
    fetch(`/api/prompt-versions?agent_type=${agentType}`)
      .then((res) => res.json())
      .then((d) => setVersions(d.versions || []));
  };

  useState(() => {
    fetchVersions();
  });

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <label htmlFor="prompt-agent">エージェント</label>
        <NativeSelect
          id="prompt-agent"
          className="w-auto"
          value={agentType}
          onChange={(e) => {
            setAgentType(e.target.value);
            setTimeout(fetchVersions, 0);
          }}
        >
          {AGENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {AGENT_LABELS[t]}
            </option>
          ))}
        </NativeSelect>
      </div>
      {versions.map((v) => (
        <Card
          key={v.id as string}
          data-version={v.version}
          data-active={String(v.active)}
          className={`mb-2 ${
            v.active ? "border-primary bg-secondary" : ""
          }`}
        >
          <CardContent className="pt-3 pb-3">
            <div className="flex justify-between">
              <span className="font-semibold">
                v{v.version as number} {v.active ? "(Active)" : ""}
              </span>
              <span className="text-sm text-muted-foreground">
                {v.changed_by as string}
              </span>
            </div>
            {v.change_summary ? (
              <p className="text-sm mt-1">{v.change_summary as string}</p>
            ) : null}
          </CardContent>
        </Card>
      ))}
      {versions.length === 0 && (
        <div className="text-center py-4 text-muted-foreground">
          バージョンなし
        </div>
      )}
    </div>
  );
}

function SuggestionsPanel() {
  const [suggestions, setSuggestions] = useState<Record<string, unknown>[]>(
    []
  );

  const fetchSuggestions = () => {
    fetch("/api/prompt-suggestions?status=pending")
      .then((res) => res.json())
      .then((d) => setSuggestions(d.suggestions || []));
  };

  useState(() => {
    fetchSuggestions();
  });

  const handleAction = async (id: number, status: string) => {
    await fetch(`/api/prompt-suggestions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchSuggestions();
  };

  return (
    <div>
      {suggestions.map((s) => (
        <Card key={s.id as number} data-suggestion className="mb-2">
          <CardContent className="pt-3 pb-3">
            <div className="flex justify-between">
              <span className="font-semibold">
                {s.agent_type as string} &mdash; {s.trigger_type as string}
              </span>
              <span className="text-sm text-muted-foreground">
                confidence: {String(s.confidence)}
              </span>
            </div>
            <p className="mt-1">{s.suggestion as string}</p>
            <div className="flex gap-2 mt-2">
              <Button
                variant="success"
                size="sm"
                onClick={() => handleAction(s.id as number, "accepted")}
              >
                承認
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleAction(s.id as number, "rejected")}
              >
                却下
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      {suggestions.length === 0 && (
        <div className="text-center py-4 text-muted-foreground">
          保留中の提案なし
        </div>
      )}
    </div>
  );
}

function GrowthPanel() {
  const [learnings, setLearnings] = useState<Record<string, unknown>[]>([]);
  const [reflections, setReflections] = useState<Record<string, unknown>[]>([]);

  useState(() => {
    // Fetch both individual learnings and reflections for growth charts
    Promise.all([
      Promise.all(
        AGENT_TYPES.map((t) =>
          fetch(`/api/individual-learnings?agent_type=${t}&limit=100`)
            .then((res) => res.json())
            .then((d) => ({ agent_type: t, data: d.learnings || [] }))
        )
      ),
      fetch("/api/reflections?limit=200")
        .then((res) => res.json())
        .then((d) => d.reflections || []),
    ]).then(([learningResults, reflectionData]) => {
      setLearnings(
        learningResults.map((r) => ({
          agent_type: r.agent_type,
          count: r.data.length,
          avg_confidence:
            r.data.length > 0
              ? (
                  r.data.reduce(
                    (sum: number, l: Record<string, unknown>) =>
                      sum + (l.confidence as number),
                    0
                  ) / r.data.length
                ).toFixed(2)
              : "0",
          avg_success_rate:
            r.data.length > 0
              ? (
                  (r.data.reduce(
                    (sum: number, l: Record<string, unknown>) =>
                      sum + ((l.success_rate as number) || 0),
                    0
                  ) /
                    r.data.length) *
                  100
                ).toFixed(1)
              : "0",
        }))
      );
      setReflections(reflectionData as Record<string, unknown>[]);
    });
  });

  // Build cross-agent self_score comparison line chart data
  const agentGroups = AGENT_TYPES.reduce((acc, t) => {
    acc[t] = reflections
      .filter((r) => r.agent_type === t)
      .sort((a, b) => (a.cycle_id as number) - (b.cycle_id as number));
    return acc;
  }, {} as Record<string, Record<string, unknown>[]>);

  const cycleMap = new Map<number, Record<string, unknown>>();
  for (const t of AGENT_TYPES) {
    const data = agentGroups[t] || [];
    for (const r of data) {
      const cycleId = r.cycle_id as number;
      const existing = cycleMap.get(cycleId) || { cycle: cycleId };
      existing[t] = r.self_score as number;
      cycleMap.set(cycleId, existing);
    }
  }
  const comparisonData = Array.from(cycleMap.values()).sort(
    (a, b) => (a.cycle as number) - (b.cycle as number)
  );
  const activeAgents = AGENT_TYPES.filter(
    (t) => (agentGroups[t] || []).length > 0
  );

  // Learning velocity: compute delta of self_score between first and last cycle
  const velocityData = AGENT_TYPES.map((t) => {
    const data = agentGroups[t] || [];
    if (data.length < 2) return null;
    const first = data[0]!.self_score as number;
    const last = data[data.length - 1]!.self_score as number;
    const cycles = data.length;
    const velocity = cycles > 1 ? ((last - first) / (cycles - 1)).toFixed(2) : "0";
    return {
      agent: AGENT_LABELS[t] || t,
      agent_type: t,
      velocity: parseFloat(velocity),
      first_score: first,
      latest_score: last,
      cycles,
    };
  }).filter((d): d is NonNullable<typeof d> => d !== null);

  return (
    <div>
      {/* Cross-agent self_score comparison */}
      {comparisonData.length > 1 && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">
              全エージェント self_score 比較
            </h3>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={comparisonData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                />
                <XAxis
                  dataKey="cycle"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  label={{
                    value: "サイクル",
                    position: "insideBottom",
                    offset: -5,
                    fill: "var(--muted-foreground)",
                  }}
                />
                <YAxis
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  domain={[0, 10]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    color: "var(--fg)",
                  }}
                />
                <Legend />
                {activeAgents.map((t) => (
                  <Line
                    key={t}
                    type="monotone"
                    dataKey={t}
                    name={AGENT_LABELS[t] || t}
                    stroke={AGENT_COLORS[t] || COLORS.violet}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Learning velocity */}
      {velocityData.length > 0 && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">
              学習速度 (サイクルあたりのスコア変化)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {velocityData.map((v) => (
                <div
                  key={v.agent_type}
                  className="flex items-center gap-3 p-3 rounded-md border"
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor:
                        AGENT_COLORS[v.agent_type] || COLORS.violet,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{v.agent}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.first_score} → {v.latest_score} ({v.cycles} cycles)
                    </p>
                  </div>
                  <span
                    className={`text-lg font-bold ${
                      v.velocity > 0
                        ? "text-[#859900]"
                        : v.velocity < 0
                        ? "text-[#dc322f]"
                        : "text-muted-foreground"
                    }`}
                  >
                    {v.velocity > 0 ? "+" : ""}
                    {v.velocity}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent growth cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {learnings.map((agent) => (
          <Card key={agent.agent_type as string} data-agent-card>
            <CardContent className="pt-4">
              <h3 className="font-semibold mb-2">
                {AGENT_LABELS[agent.agent_type as string] ||
                  (agent.agent_type as string)}
              </h3>
              <div className="space-y-1 text-sm">
                <p>
                  学習 (learning) 数:{" "}
                  <strong>{agent.count as number}</strong>
                </p>
                <p>
                  平均スコア (score):{" "}
                  <strong>{agent.avg_confidence as string}</strong>
                </p>
                <p>
                  振り返り (reflection) 成功率:{" "}
                  <strong>{agent.avg_success_rate as string}%</strong>
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {learnings.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          データがありません
        </div>
      )}
    </div>
  );
}

function InboxPanel() {
  const [messages, setMessages] = useState<Record<string, unknown>[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [replyId, setReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [total, setTotal] = useState(0);

  const fetchMessages = () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/communications?${params}`)
      .then((res) => res.json())
      .then((d) => {
        setMessages(d.messages || []);
        setTotal(d.total || 0);
      });
  };

  useState(() => {
    fetchMessages();
  });

  const unreadCount = messages.filter((m) => m.status === "unread").length;

  const handleReply = async (id: string) => {
    if (!replyText.trim()) return;
    await fetch(`/api/communications/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ human_response: replyText }),
    });
    setReplyId(null);
    setReplyText("");
    fetchMessages();
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <NativeSelect
          aria-label="ステータス"
          className="w-auto"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setTimeout(fetchMessages, 0);
          }}
        >
          <option value="">全て</option>
          <option value="unread">unread</option>
          <option value="read">read</option>
          <option value="responded">responded</option>
        </NativeSelect>
        {unreadCount > 0 && (
          <Badge variant="destructive" data-unread>
            {unreadCount}
          </Badge>
        )}
      </div>

      {messages.map((msg) => (
        <Card key={msg.id as string} data-message className="mb-2">
          <CardContent className="pt-3 pb-3">
            <div className="flex justify-between">
              <span className="font-semibold">
                {AGENT_LABELS[msg.agent_type as string] ||
                  (msg.agent_type as string)}
              </span>
              <Badge
                variant={
                  msg.status === "unread"
                    ? "default"
                    : msg.status === "responded"
                    ? "success"
                    : "secondary"
                }
              >
                {msg.status as string}
              </Badge>
            </div>
            <p className="mt-1">{msg.content as string}</p>
            {msg.human_response ? (
              <p className="mt-1 text-sm text-[var(--accent-cyan)]">
                返信: {msg.human_response as string}
              </p>
            ) : null}
            {replyId === (msg.id as string) ? (
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="返信"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  onClick={() => handleReply(msg.id as string)}
                >
                  返信
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => setReplyId(msg.id as string)}
              >
                返信する
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
      {messages.length === 0 && (
        <div className="text-center py-4 text-muted-foreground">
          メッセージなし
        </div>
      )}
    </div>
  );
}
