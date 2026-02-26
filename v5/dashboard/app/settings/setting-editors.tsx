"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface Constraints {
  min?: number;
  max?: number;
  options?: string[];
  [key: string]: unknown;
}

interface SettingEditorProps {
  settingKey: string;
  value: unknown;
  valueType: string;
  constraints: Constraints | null;
  editing: boolean;
  editValue: unknown;
  onEditValueChange: (value: unknown) => void;
  t: (key: string) => string;
}

// ── Inline value editors (shown in the Value cell) ──

export function SettingValueCell({
  settingKey,
  value,
  valueType,
  constraints,
  editing,
  editValue,
  onEditValueChange,
  t,
}: SettingEditorProps) {
  switch (valueType) {
    case "integer":
      return (
        <IntegerEditor
          value={value}
          editing={editing}
          editValue={editValue}
          onEditValueChange={onEditValueChange}
          constraints={constraints}
        />
      );
    case "float":
      return (
        <FloatEditor
          value={value}
          editing={editing}
          editValue={editValue}
          onEditValueChange={onEditValueChange}
          constraints={constraints}
        />
      );
    case "boolean":
      return (
        <BooleanEditor
          value={value}
          editing={editing}
          editValue={editValue}
          onEditValueChange={onEditValueChange}
          t={t}
        />
      );
    case "enum":
      return (
        <EnumEditor
          value={value}
          editing={editing}
          editValue={editValue}
          onEditValueChange={onEditValueChange}
          constraints={constraints}
        />
      );
    case "string":
      return (
        <StringEditor
          settingKey={settingKey}
          value={value}
          editing={editing}
          editValue={editValue}
          onEditValueChange={onEditValueChange}
          t={t}
        />
      );
    case "json":
      return (
        <JsonDisplay value={value} settingKey={settingKey} t={t} />
      );
    default:
      return (
        <span className="font-mono text-xs">
          {JSON.stringify(value)}
        </span>
      );
  }
}

// ── Integer Editor ──

function IntegerEditor({
  value,
  editing,
  editValue,
  onEditValueChange,
  constraints,
}: {
  value: unknown;
  editing: boolean;
  editValue: unknown;
  onEditValueChange: (v: unknown) => void;
  constraints: Constraints | null;
}) {
  if (!editing) {
    return <span className="font-mono text-xs">{String(value)}</span>;
  }
  return (
    <Input
      type="number"
      className="h-8"
      value={String(editValue ?? "")}
      min={constraints?.min}
      max={constraints?.max}
      step={1}
      onChange={(e) => {
        const v = e.target.value;
        onEditValueChange(v === "" ? "" : Number(v));
      }}
    />
  );
}

// ── Float Editor ──

function FloatEditor({
  value,
  editing,
  editValue,
  onEditValueChange,
  constraints,
}: {
  value: unknown;
  editing: boolean;
  editValue: unknown;
  onEditValueChange: (v: unknown) => void;
  constraints: Constraints | null;
}) {
  if (!editing) {
    return <span className="font-mono text-xs">{String(value)}</span>;
  }
  return (
    <Input
      type="number"
      className="h-8"
      value={String(editValue ?? "")}
      min={constraints?.min}
      max={constraints?.max}
      step={0.01}
      onChange={(e) => {
        const v = e.target.value;
        onEditValueChange(v === "" ? "" : Number(v));
      }}
    />
  );
}

// ── Boolean Editor (always shows Switch) ──

function BooleanEditor({
  value,
  editing,
  editValue,
  onEditValueChange,
  t,
}: {
  value: unknown;
  editing: boolean;
  editValue: unknown;
  onEditValueChange: (v: unknown) => void;
  t: (key: string) => string;
}) {
  const displayValue = editing ? editValue : value;
  const checked = displayValue === true || displayValue === "true";
  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={checked}
        onCheckedChange={(v) => onEditValueChange(v)}
        disabled={!editing}
      />
      <span className="text-xs text-muted-foreground">
        {checked ? t("settings.enabled") : t("settings.disabled")}
      </span>
    </div>
  );
}

// ── Enum Editor ──

function EnumEditor({
  value,
  editing,
  editValue,
  onEditValueChange,
  constraints,
}: {
  value: unknown;
  editing: boolean;
  editValue: unknown;
  onEditValueChange: (v: unknown) => void;
  constraints: Constraints | null;
}) {
  const options = constraints?.options ?? [];
  if (!editing) {
    return <span className="font-mono text-xs">{String(value)}</span>;
  }
  return (
    <NativeSelect
      className="h-8"
      value={String(editValue ?? "")}
      onChange={(e) => onEditValueChange(e.target.value)}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </NativeSelect>
  );
}

// ── String Editor ──

function StringEditor({
  settingKey,
  value,
  editing,
  editValue,
  onEditValueChange,
  t,
}: {
  settingKey: string;
  value: unknown;
  editing: boolean;
  editValue: unknown;
  onEditValueChange: (v: unknown) => void;
  t: (key: string) => string;
}) {
  const isCredential = settingKey.startsWith("CRED_");
  if (!editing) {
    return (
      <span className="font-mono text-xs">
        {isCredential ? t("settings.masked") : String(value)}
      </span>
    );
  }
  return (
    <Input
      type={isCredential ? "password" : "text"}
      className="h-8"
      value={String(editValue ?? "")}
      onChange={(e) => onEditValueChange(e.target.value)}
    />
  );
}

// ── JSON Display (inline — shows preview + Edit triggers expansion in parent) ──

function JsonDisplay({
  value,
  settingKey,
  t,
}: {
  value: unknown;
  settingKey: string;
  t: (key: string) => string;
}) {
  const preview = getJsonPreview(value, settingKey, t);
  return (
    <span className="font-mono text-xs text-muted-foreground">{preview}</span>
  );
}

function getJsonPreview(value: unknown, settingKey: string, t: (key: string) => string): string {
  if (settingKey === "AUTH_ALLOWED_EMAILS" && Array.isArray(value)) {
    return value.length > 0 ? `[${value.join(", ")}]` : "[]";
  }
  if (settingKey === "AUTH_USER_ROLES" && typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries.length > 0
      ? entries.map(([k, v]) => `${k}: ${String(v)}`).join(", ")
      : "{}";
  }
  if (settingKey === "METRICS_FOLLOWUP_DAYS" && Array.isArray(value)) {
    return `[${value.join(", ")}]`;
  }
  return JSON.stringify(value);
}

// ── JSON Expansion Panel (rendered in a separate row below the setting) ──

interface JsonEditorPanelProps {
  settingKey: string;
  editValue: unknown;
  onEditValueChange: (value: unknown) => void;
  t: (key: string) => string;
}

export function JsonEditorPanel({
  settingKey,
  editValue,
  onEditValueChange,
  t,
}: JsonEditorPanelProps) {
  switch (settingKey) {
    case "AUTH_ALLOWED_EMAILS":
      return (
        <TagListEditor
          value={editValue}
          onValueChange={onEditValueChange}
          placeholder={t("settings.emailPlaceholder")}
          addLabel={t("settings.addEmail")}
        />
      );
    case "AUTH_USER_ROLES":
      return (
        <KeyValueEditor
          value={editValue}
          onValueChange={onEditValueChange}
          t={t}
        />
      );
    case "METRICS_FOLLOWUP_DAYS":
      return (
        <NumberTagListEditor
          value={editValue}
          onValueChange={onEditValueChange}
          placeholder={t("settings.dayPlaceholder")}
          addLabel={t("settings.addDay")}
        />
      );
    default:
      return (
        <JsonTextareaEditor
          value={editValue}
          onValueChange={onEditValueChange}
        />
      );
  }
}

// ── Tag List Editor (for string arrays like AUTH_ALLOWED_EMAILS) ──

function TagListEditor({
  value,
  onValueChange,
  placeholder,
  addLabel,
}: {
  value: unknown;
  onValueChange: (v: unknown) => void;
  placeholder: string;
  addLabel: string;
}) {
  const items = Array.isArray(value) ? (value as string[]) : [];
  const [inputValue, setInputValue] = useState("");

  const addItem = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !items.includes(trimmed)) {
      onValueChange([...items, trimmed]);
      setInputValue("");
    }
  };

  const removeItem = (index: number) => {
    onValueChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <Badge key={i} variant="secondary" className="gap-1 pr-1">
            {item}
            <button
              type="button"
              className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
              onClick={() => removeItem(i)}
            >
              <span className="text-xs leading-none">&times;</span>
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          className="h-8 flex-1"
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
        />
        <Button size="sm" onClick={addItem}>
          {addLabel}
        </Button>
      </div>
    </div>
  );
}

// ── Key-Value Editor (for AUTH_USER_ROLES: { email: role }) ──

function KeyValueEditor({
  value,
  onValueChange,
  t,
}: {
  value: unknown;
  onValueChange: (v: unknown) => void;
  t: (key: string) => string;
}) {
  const obj =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, string>)
      : {};
  const entries = Object.entries(obj);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("viewer");

  const addRow = () => {
    const trimmed = newEmail.trim();
    if (trimmed && !(trimmed in obj)) {
      onValueChange({ ...obj, [trimmed]: newRole });
      setNewEmail("");
      setNewRole("viewer");
    }
  };

  const removeRow = (key: string) => {
    const next = { ...obj };
    delete next[key];
    onValueChange(next);
  };

  const updateRole = (key: string, role: string) => {
    onValueChange({ ...obj, [key]: role });
  };

  return (
    <div className="space-y-3 p-4">
      {entries.map(([email, role]) => (
        <div key={email} className="flex items-center gap-2">
          <span className="font-mono text-xs flex-1 truncate">{email}</span>
          <NativeSelect
            className="h-8 w-28"
            value={role}
            onChange={(e) => updateRole(email, e.target.value)}
          >
            <option value="admin">admin</option>
            <option value="viewer">viewer</option>
          </NativeSelect>
          <button
            type="button"
            className="text-destructive hover:text-destructive/80 text-sm px-1"
            onClick={() => removeRow(email)}
          >
            &times;
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 border-t border-border pt-3">
        <Input
          className="h-8 flex-1"
          placeholder={t("settings.emailPlaceholder")}
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addRow();
            }
          }}
        />
        <NativeSelect
          className="h-8 w-28"
          value={newRole}
          onChange={(e) => setNewRole(e.target.value)}
        >
          <option value="admin">admin</option>
          <option value="viewer">viewer</option>
        </NativeSelect>
        <Button size="sm" onClick={addRow}>
          {t("settings.addRow")}
        </Button>
      </div>
    </div>
  );
}

// ── Number Tag List Editor (for METRICS_FOLLOWUP_DAYS: number[]) ──

function NumberTagListEditor({
  value,
  onValueChange,
  placeholder,
  addLabel,
}: {
  value: unknown;
  onValueChange: (v: unknown) => void;
  placeholder: string;
  addLabel: string;
}) {
  const items = Array.isArray(value) ? (value as number[]) : [];
  const [inputValue, setInputValue] = useState("");

  const addItem = () => {
    const num = Number(inputValue.trim());
    if (!isNaN(num) && !items.includes(num)) {
      onValueChange([...items, num].sort((a, b) => a - b));
      setInputValue("");
    }
  };

  const removeItem = (index: number) => {
    onValueChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <Badge key={i} variant="secondary" className="gap-1 pr-1">
            {item}
            <button
              type="button"
              className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
              onClick={() => removeItem(i)}
            >
              <span className="text-xs leading-none">&times;</span>
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          type="number"
          className="h-8 w-32"
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
        />
        <Button size="sm" onClick={addItem}>
          {addLabel}
        </Button>
      </div>
    </div>
  );
}

// ── Fallback JSON Textarea Editor ──

function JsonTextareaEditor({
  value,
  onValueChange,
}: {
  value: unknown;
  onValueChange: (v: unknown) => void;
}) {
  const [text, setText] = useState(() =>
    typeof value === "string" ? value : JSON.stringify(value, null, 2)
  );
  const [parseError, setParseError] = useState<string | null>(null);

  const handleChange = (newText: string) => {
    setText(newText);
    try {
      const parsed = JSON.parse(newText);
      onValueChange(parsed);
      setParseError(null);
    } catch {
      setParseError("Invalid JSON");
    }
  };

  return (
    <div className="space-y-2 p-4">
      <textarea
        className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        value={text}
        onChange={(e) => handleChange(e.target.value)}
      />
      {parseError && (
        <p className="text-xs text-destructive">{parseError}</p>
      )}
    </div>
  );
}
