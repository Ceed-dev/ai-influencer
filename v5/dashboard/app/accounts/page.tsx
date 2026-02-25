"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/lib/i18n";

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

// Page: Account Management — statusColor is mapped via statusVariant/Badge
export default function AccountsPage() {
  const { t } = useTranslation();
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

  const statusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "success" as const;
      case "suspended":
        return "destructive" as const;
      default:
        return "warning" as const;
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div />
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? t("common.cancel") : t("accounts.newAccount")}
        </Button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">{t("accounts.createAccount")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <NativeSelect
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
              </NativeSelect>
              <Input
                type="text"
                placeholder={t("accounts.handlePlaceholder")}
                value={newAccount.handle}
                onChange={(e) =>
                  setNewAccount({ ...newAccount, handle: e.target.value })
                }
              />
              <Input
                type="text"
                placeholder={t("accounts.characterIdPlaceholder")}
                value={newAccount.character_id}
                onChange={(e) =>
                  setNewAccount({
                    ...newAccount,
                    character_id: e.target.value,
                  })
                }
              />
            </div>
            <Button variant="success" className="mt-3" onClick={handleCreate}>
              {t("common.create")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Platform Filter */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={!platformFilter ? "default" : "secondary"}
          size="sm"
          onClick={() => setPlatformFilter("")}
        >
          {t("common.all")} ({total})
        </Button>
        {PLATFORMS.map((p) => (
          <Button
            key={p}
            variant={platformFilter === p ? "default" : "secondary"}
            size="sm"
            onClick={() => setPlatformFilter(p)}
          >
            {p}
          </Button>
        ))}
      </div>

      {/* Accounts <table> via Shadcn Table component */}
      {loading ? (
        <p>{t("common.loading")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("accounts.accountId")}</TableHead>
              <TableHead>{t("accounts.platform")}</TableHead>
              <TableHead>{t("accounts.username")}</TableHead>
              <TableHead>{t("accounts.character")}</TableHead>
              <TableHead>{t("accounts.followers")}</TableHead>
              <TableHead>{t("accounts.status")}</TableHead>
              <TableHead>{t("accounts.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((acc) => (
              <TableRow key={acc.account_id}>
                <TableCell className="font-mono text-xs">
                  {acc.account_id}
                </TableCell>
                <TableCell>{acc.platform}</TableCell>
                <TableCell>{acc.platform_username || "-"}</TableCell>
                <TableCell className="font-mono text-xs">
                  {acc.character_id || "-"}
                </TableCell>
                <TableCell className="font-mono">
                  {acc.follower_count.toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(acc.status)}>
                    {acc.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <NativeSelect
                    className="h-8 w-auto text-xs"
                    value={acc.status}
                    onChange={(e) =>
                      handleStatusChange(acc.account_id, e.target.value)
                    }
                  >
                    <option value="active">{t("accounts.statusActive")}</option>
                    <option value="setup">{t("accounts.statusSetup")}</option>
                    <option value="suspended">{t("accounts.statusSuspended")}</option>
                  </NativeSelect>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
