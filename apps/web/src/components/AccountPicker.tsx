"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { accountLabel, type Account } from "@/lib/useAccounts";

/**
 * Account switcher shared by the dashboard and transaction list. Also lets a
 * CSV upload be renamed inline, so imports can be tagged ("RBC chequing")
 * and filtered afterwards.
 */
export default function AccountPicker({
  accounts,
  value,
  onChange,
  onRenamed,
}: {
  accounts: Account[];
  value: string;
  onChange: (accountId: string) => void;
  onRenamed?: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");

  const selected = accounts.find((a) => a._docID === value);

  async function saveName() {
    if (!selected || !draft.trim()) return setRenaming(false);
    try {
      await api(`/banks/accounts/${selected._docID}`, {
        method: "PATCH",
        body: JSON.stringify({ accountName: draft.trim() }),
      });
      onRenamed?.();
    } finally {
      setRenaming(false);
    }
  }

  if (accounts.length === 0) return null;

  return (
    <span className="inline-flex items-center gap-2">
      <select
        className="card px-2 py-1.5 text-sm cursor-pointer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Filter by account"
      >
        <option value="">All accounts</option>
        {accounts.map((a) => (
          <option key={a._docID} value={a._docID}>
            {accountLabel(a)} ({a.transactionCount})
          </option>
        ))}
      </select>
      {selected && !renaming && (
        <button
          className="text-xs text-muted hover:text-ink underline"
          title="Rename this account"
          onClick={() => {
            setDraft(selected.accountName);
            setRenaming(true);
          }}
        >
          rename
        </button>
      )}
      {selected && renaming && (
        <span className="inline-flex items-center gap-1">
          <input
            className="card px-2 py-1 text-xs w-32"
            value={draft}
            autoFocus
            maxLength={48}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveName();
              if (e.key === "Escape") setRenaming(false);
            }}
          />
          <button className="text-xs px-2 py-1 rounded border border-hairline" onClick={saveName}>
            save
          </button>
        </span>
      )}
    </span>
  );
}
