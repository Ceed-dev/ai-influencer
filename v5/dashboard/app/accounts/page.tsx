"use client";

import { useState, useEffect, useCallback } from "react";

interface Account {
  id: number;
  account_id: string;
  platform: string;
  platform_username: string | null;
  character_id: string | null;
  niche: string | null;
  status: string;
  follower_count: number;
  created_at: string;
}

const PLATFORMS = ["youtube", "tiktok", "instagram", "x"] as const;

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState<string>("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAccount, setNewAccount] = useState({
    platform: "youtube",
    handle: "",
    character_id: "",
  });

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const url = platformFilter
        ? `/api/accounts?platform=${platformFilter}`
        : "/api/accounts";
      const res = await fetch(url);
      const data = await res.json();
      setAccounts(data.accounts || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to fetch accounts:", err);
    } finally {
      setLoading(false);
    }
  }, [platformFilter]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleCreate = async () => {
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAccount),
      });
      if (res.ok) {
        setShowCreateForm(false);
        setNewAccount({ platform: "youtube", handle: "", character_id: "" });
        fetchAccounts();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create");
      }
    } catch (err) {
      console.error("Create failed:", err);
    }
  };

  const handleStatusChange = async (accountId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchAccounts();
      }
    } catch (err) {
      console.error("Update failed:", err);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "active":
        return "var(--success)";
      case "suspended":
        return "var(--error)";
      default:
        return "var(--warning)";
    }
  };

  return (
    <main className="min-h-screen p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Account Management</h1>
        <button
          className="px-4 py-2 rounded font-semibold text-sm"
          style={{ backgroundColor: "var(--accent-blue)", color: "#fff" }}
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? "Cancel" : "New Account"}
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div
          className="p-4 rounded-lg mb-6"
          style={{ backgroundColor: "var(--card-bg)" }}
        >
          <h2 className="text-lg font-semibold mb-3">Create Account</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              className="p-2 rounded text-sm"
              style={{
                backgroundColor: "var(--bg)",
                color: "var(--fg)",
              }}
              value={newAccount.platform}
              onChange={(e) =>
                setNewAccount({ ...newAccount, platform: e.target.value })
              }
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <input
              type="text"
              className="p-2 rounded text-sm"
              style={{
                backgroundColor: "var(--bg)",
                color: "var(--fg)",
              }}
              placeholder="Handle (@username)"
              value={newAccount.handle}
              onChange={(e) =>
                setNewAccount({ ...newAccount, handle: e.target.value })
              }
            />
            <input
              type="text"
              className="p-2 rounded text-sm"
              style={{
                backgroundColor: "var(--bg)",
                color: "var(--fg)",
              }}
              placeholder="Character ID (CHR_XXXX)"
              value={newAccount.character_id}
              onChange={(e) =>
                setNewAccount({ ...newAccount, character_id: e.target.value })
              }
            />
          </div>
          <button
            className="mt-3 px-4 py-2 rounded font-semibold text-sm"
            style={{ backgroundColor: "var(--success)", color: "#fff" }}
            onClick={handleCreate}
          >
            Create
          </button>
        </div>
      )}

      {/* Platform Filter */}
      <div className="flex gap-2 mb-4">
        <button
          className="px-3 py-1 rounded text-sm"
          style={{
            backgroundColor: !platformFilter
              ? "var(--accent-blue)"
              : "var(--card-bg)",
            color: !platformFilter ? "#fff" : "var(--fg)",
          }}
          onClick={() => setPlatformFilter("")}
        >
          All ({total})
        </button>
        {PLATFORMS.map((p) => (
          <button
            key={p}
            className="px-3 py-1 rounded text-sm"
            style={{
              backgroundColor:
                platformFilter === p
                  ? "var(--accent-blue)"
                  : "var(--card-bg)",
              color: platformFilter === p ? "#fff" : "var(--fg)",
            }}
            onClick={() => setPlatformFilter(p)}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Accounts Table */}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="text-left p-2">Account ID</th>
                <th className="text-left p-2">Platform</th>
                <th className="text-left p-2">Username</th>
                <th className="text-left p-2">Character</th>
                <th className="text-left p-2">Followers</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => (
                <tr
                  key={acc.account_id}
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <td className="p-2 font-mono text-xs">{acc.account_id}</td>
                  <td className="p-2">{acc.platform}</td>
                  <td className="p-2">{acc.platform_username || "-"}</td>
                  <td className="p-2 font-mono text-xs">
                    {acc.character_id || "-"}
                  </td>
                  <td className="p-2 font-mono">
                    {acc.follower_count.toLocaleString()}
                  </td>
                  <td className="p-2">
                    <span
                      className="px-2 py-1 rounded text-xs"
                      style={{
                        backgroundColor: statusColor(acc.status),
                        color: "#fff",
                      }}
                    >
                      {acc.status}
                    </span>
                  </td>
                  <td className="p-2">
                    <select
                      className="p-1 rounded text-xs"
                      style={{
                        backgroundColor: "var(--bg)",
                        color: "var(--fg)",
                      }}
                      value={acc.status}
                      onChange={(e) =>
                        handleStatusChange(acc.account_id, e.target.value)
                      }
                    >
                      <option value="active">Active</option>
                      <option value="setup">Setup</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
