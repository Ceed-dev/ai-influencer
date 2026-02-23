"use client";

import { useState } from "react";

const TABS = [
  { id: "thought-log", label: "思考ログ" },
  { id: "dialogue", label: "対話" },
  { id: "evolution", label: "進化" },
  { id: "prompt", label: "プロンプト管理" },
  { id: "suggestions", label: "改善提案" },
  { id: "growth", label: "個別成長" },
  { id: "inbox", label: "受信トレイ" },
];

const AGENT_TYPES = [
  "strategist", "researcher", "analyst", "planner", "tool_specialist", "data_curator"
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
  const [activeTab, setActiveTab] = useState("thought-log");

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-6">Agent Management</h1>

      <div role="tablist" className="flex gap-1 mb-6 border-b border-[var(--border)]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm rounded-t ${
              activeTab === tab.id
                ? "bg-[var(--card-bg)] border border-b-0 border-[var(--border)] text-[var(--accent-blue)]"
                : "text-[var(--muted)] hover:text-[var(--fg)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {activeTab === "thought-log" && <ThoughtLogPanel />}
        {activeTab === "dialogue" && <DialoguePanel />}
        {activeTab === "evolution" && <EvolutionPanel />}
        {activeTab === "prompt" && <PromptPanel />}
        {activeTab === "suggestions" && <SuggestionsPanel />}
        {activeTab === "growth" && <GrowthPanel />}
        {activeTab === "inbox" && <InboxPanel />}
      </div>
    </main>
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

  useState(() => { fetchLogs(); });

  return (
    <div>
      <div className="mb-4">
        <label htmlFor="agent-filter">エージェント</label>
        <select id="agent-filter" value={agentType} onChange={(e) => { setAgentType(e.target.value); setTimeout(fetchLogs, 0); }} className="ml-2 px-3 py-1 rounded bg-[var(--card-bg)] border border-[var(--border)]">
          <option value="">全て</option>
          {AGENT_TYPES.map((t) => <option key={t} value={t}>{AGENT_LABELS[t] || t}</option>)}
        </select>
      </div>
      {logs.map((log) => (
        <div key={log.id as string} data-log-entry data-agent-type={log.agent_type as string} className="border border-[var(--border)] rounded p-3 mb-2 cursor-pointer" onClick={() => setExpandedId(expandedId === (log.id as string) ? null : (log.id as string))}>
          <div className="flex justify-between">
            <span className="font-semibold">{log.node_name as string}</span>
            <span className="text-sm text-[var(--muted)]">{log.agent_type as string} | Cycle {log.cycle_id as number}</span>
          </div>
          <p className="text-sm mt-1 truncate">{log.decision as string}</p>
          {expandedId === (log.id as string) && (
            <div className="mt-3 space-y-2 text-sm">
              <div><strong>読み取りデータ (input_data)</strong>: <pre className="bg-[var(--bg)] p-2 rounded mt-1 overflow-auto">{JSON.stringify(log.input_summary, null, 2)}</pre></div>
              <div><strong>考慮事項 (reasoning)</strong>: <p className="mt-1">{log.reasoning as string}</p></div>
              <div><strong>判断 (output)</strong>: <p className="mt-1">{log.decision as string}</p></div>
              {(log.tools_used as string[])?.length > 0 && (
                <div><strong>MCP Tools</strong>: {(log.tools_used as string[]).join(", ")}</div>
              )}
            </div>
          )}
        </div>
      ))}
      {logs.length === 0 && <div className="text-center py-8 text-[var(--muted)]">データがありません</div>}
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

  useState(() => { fetchMessages(); });

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    await fetch("/api/communications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_type: selectedAgent, message_type: "status_report", priority, content: newMessage }),
    });
    setNewMessage("");
    fetchMessages();
  };

  return (
    <div className="flex gap-4">
      <div className="w-48 space-y-1">
        {AGENT_TYPES.map((t) => (
          <button key={t} onClick={() => { setSelectedAgent(t); setTimeout(fetchMessages, 0); }} className={`w-full text-left px-3 py-2 rounded ${selectedAgent === t ? "bg-[var(--accent-blue)] text-white" : "hover:bg-[var(--sidebar-bg)]"}`}>
            {AGENT_LABELS[t]}
          </button>
        ))}
      </div>
      <div className="flex-1">
        <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
          {messages.map((msg) => (
            <div key={msg.id as string} className="p-3 rounded border border-[var(--border)]" data-status={msg.status as string}>
              <div className="flex justify-between text-sm">
                <span className="font-semibold">{msg.message_type as string}</span>
                <span className={`px-2 rounded text-xs ${msg.status === "responded" ? "bg-green-900 text-green-200" : msg.status === "unread" ? "bg-blue-900 text-blue-200" : "bg-gray-700 text-gray-300"}`}>
                  {msg.status === "applied" ? "適用済み" : msg.status === "pending" ? "保留中" : msg.status as string}
                </span>
              </div>
              <p className="mt-1">{msg.content as string}</p>
              {msg.human_response && <p className="mt-1 text-sm text-[var(--accent-cyan)]">返信: {msg.human_response as string}</p>}
            </div>
          ))}
          {messages.length === 0 && <div className="text-center py-4 text-[var(--muted)]">メッセージなし</div>}
        </div>
        <div className="flex gap-2">
          <input placeholder="指示を入力" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} className="flex-1 px-3 py-2 rounded bg-[var(--card-bg)] border border-[var(--border)]" />
          <select aria-label="優先度" value={priority} onChange={(e) => setPriority(e.target.value)} className="px-3 py-2 rounded bg-[var(--card-bg)] border border-[var(--border)]">
            <option value="low">low</option>
            <option value="normal">normal</option>
            <option value="high">high</option>
            <option value="urgent">urgent</option>
          </select>
          <button onClick={sendMessage} className="px-4 py-2 bg-[var(--accent-blue)] text-white rounded hover:opacity-90">送信</button>
        </div>
      </div>
    </div>
  );
}

function EvolutionPanel() {
  const [reflections, setReflections] = useState<Record<string, unknown>[]>([]);

  useState(() => {
    fetch("/api/reflections")
      .then((res) => res.json())
      .then((d) => setReflections(d.reflections || []));
  });

  const agentGroups = AGENT_TYPES.reduce((acc, t) => {
    acc[t] = reflections.filter((r) => r.agent_type === t).sort((a, b) => (a.cycle_id as number) - (b.cycle_id as number));
    return acc;
  }, {} as Record<string, Record<string, unknown>[]>);

  return (
    <div>
      {AGENT_TYPES.map((t) => {
        const data = agentGroups[t] || [];
        if (data.length === 0) return null;
        return (
          <div key={t} className="mb-6">
            <h3 className="font-semibold mb-2">{AGENT_LABELS[t]} - self_score 推移</h3>
            <div className="flex items-end gap-1 h-24">
              {data.map((r, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="bg-[var(--accent-blue)] rounded-t" style={{ width: 20, height: `${(r.self_score as number) * 10}%` }} title={`Cycle ${r.cycle_id}: ${r.self_score}`} />
                  <span className="text-xs mt-1">{r.self_score as number}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {reflections.length === 0 && <div className="text-center py-8 text-[var(--muted)]">データがありません</div>}
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

  useState(() => { fetchVersions(); });

  return (
    <div>
      <div className="mb-4">
        <label htmlFor="prompt-agent">エージェント</label>
        <select id="prompt-agent" value={agentType} onChange={(e) => { setAgentType(e.target.value); setTimeout(fetchVersions, 0); }} className="ml-2 px-3 py-1 rounded bg-[var(--card-bg)] border border-[var(--border)]">
          {AGENT_TYPES.map((t) => <option key={t} value={t}>{AGENT_LABELS[t]}</option>)}
        </select>
      </div>
      {versions.map((v) => (
        <div key={v.id as string} data-version={v.version} data-active={String(v.active)} className={`p-3 mb-2 rounded border ${v.active ? "border-[var(--accent-blue)] bg-[var(--sidebar-bg)]" : "border-[var(--border)]"}`}>
          <div className="flex justify-between">
            <span className="font-semibold">v{v.version as number} {v.active ? "(Active)" : ""}</span>
            <span className="text-sm text-[var(--muted)]">{v.changed_by as string}</span>
          </div>
          {v.change_summary && <p className="text-sm mt-1">{v.change_summary as string}</p>}
        </div>
      ))}
      {versions.length === 0 && <div className="text-center py-4 text-[var(--muted)]">バージョンなし</div>}
    </div>
  );
}

function SuggestionsPanel() {
  const [suggestions, setSuggestions] = useState<Record<string, unknown>[]>([]);

  const fetchSuggestions = () => {
    fetch("/api/prompt-suggestions?status=pending")
      .then((res) => res.json())
      .then((d) => setSuggestions(d.suggestions || []));
  };

  useState(() => { fetchSuggestions(); });

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
        <div key={s.id as number} data-suggestion className="p-3 mb-2 rounded border border-[var(--border)]">
          <div className="flex justify-between">
            <span className="font-semibold">{s.agent_type as string} — {s.trigger_type as string}</span>
            <span className="text-sm text-[var(--muted)]">confidence: {String(s.confidence)}</span>
          </div>
          <p className="mt-1">{s.suggestion as string}</p>
          <div className="flex gap-2 mt-2">
            <button onClick={() => handleAction(s.id as number, "accepted")} className="px-3 py-1 bg-green-700 text-white rounded text-sm">承認</button>
            <button onClick={() => handleAction(s.id as number, "rejected")} className="px-3 py-1 bg-red-700 text-white rounded text-sm">却下</button>
          </div>
        </div>
      ))}
      {suggestions.length === 0 && <div className="text-center py-4 text-[var(--muted)]">保留中の提案なし</div>}
    </div>
  );
}

function GrowthPanel() {
  const [learnings, setLearnings] = useState<Record<string, unknown>[]>([]);

  useState(() => {
    Promise.all(
      AGENT_TYPES.map((t) =>
        fetch(`/api/individual-learnings?agent_type=${t}&limit=100`)
          .then((res) => res.json())
          .then((d) => ({ agent_type: t, data: d.learnings || [] }))
      )
    ).then((results) => {
      setLearnings(results.map((r) => ({
        agent_type: r.agent_type,
        count: r.data.length,
        avg_confidence: r.data.length > 0 ? (r.data.reduce((sum: number, l: Record<string, unknown>) => sum + (l.confidence as number), 0) / r.data.length).toFixed(2) : "0",
        avg_success_rate: r.data.length > 0 ? (r.data.reduce((sum: number, l: Record<string, unknown>) => sum + (l.success_rate as number || 0), 0) / r.data.length * 100).toFixed(1) : "0",
      })));
    });
  });

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {learnings.map((agent) => (
          <div key={agent.agent_type as string} data-agent-card className="p-4 rounded border border-[var(--border)] bg-[var(--card-bg)]">
            <h3 className="font-semibold mb-2">{AGENT_LABELS[agent.agent_type as string] || agent.agent_type as string}</h3>
            <div className="space-y-1 text-sm">
              <p>学習 (learning) 数: <strong>{agent.count as number}</strong></p>
              <p>平均スコア (score): <strong>{agent.avg_confidence as string}</strong></p>
              <p>振り返り (reflection) 成功率: <strong>{agent.avg_success_rate as string}%</strong></p>
            </div>
          </div>
        ))}
      </div>
      {learnings.length === 0 && <div className="text-center py-8 text-[var(--muted)]">データがありません</div>}
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
      .then((d) => { setMessages(d.messages || []); setTotal(d.total || 0); });
  };

  useState(() => { fetchMessages(); });

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
        <select aria-label="ステータス" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setTimeout(fetchMessages, 0); }} className="px-3 py-1 rounded bg-[var(--card-bg)] border border-[var(--border)]">
          <option value="">全て</option>
          <option value="unread">unread</option>
          <option value="read">read</option>
          <option value="responded">responded</option>
        </select>
        {unreadCount > 0 && <span className="badge px-2 py-1 bg-red-600 text-white rounded-full text-xs" data-unread>{unreadCount}</span>}
      </div>

      {messages.map((msg) => (
        <div key={msg.id as string} data-message className="p-3 mb-2 rounded border border-[var(--border)]">
          <div className="flex justify-between">
            <span className="font-semibold">{AGENT_LABELS[msg.agent_type as string] || msg.agent_type as string}</span>
            <span className={`text-xs px-2 py-1 rounded ${msg.status === "unread" ? "bg-blue-900 text-blue-200" : msg.status === "responded" ? "bg-green-900 text-green-200" : "bg-gray-700 text-gray-300"}`}>
              {msg.status as string}
            </span>
          </div>
          <p className="mt-1">{msg.content as string}</p>
          {msg.human_response && <p className="mt-1 text-sm text-[var(--accent-cyan)]">返信: {msg.human_response as string}</p>}
          {replyId === (msg.id as string) ? (
            <div className="flex gap-2 mt-2">
              <input placeholder="返信" value={replyText} onChange={(e) => setReplyText(e.target.value)} className="flex-1 px-2 py-1 rounded bg-[var(--card-bg)] border border-[var(--border)]" />
              <button onClick={() => handleReply(msg.id as string)} className="px-3 py-1 bg-[var(--accent-blue)] text-white rounded text-sm">返信</button>
            </div>
          ) : (
            <button onClick={() => setReplyId(msg.id as string)} className="mt-2 px-3 py-1 bg-[var(--card-bg)] border border-[var(--border)] rounded text-sm">返信する</button>
          )}
        </div>
      ))}
      {messages.length === 0 && <div className="text-center py-4 text-[var(--muted)]">メッセージなし</div>}
    </div>
  );
}
