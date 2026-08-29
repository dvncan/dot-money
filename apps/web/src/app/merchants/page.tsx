"use client";
import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import AddMerchant, { type MerchantRecord } from "@/components/AddMerchant";
import { api, fmtCad } from "@/lib/api";
import { categoryColor } from "@/lib/colors";
import { useCategories } from "@/lib/useCategories";

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function MerchantsPage() {
  const { categories: CATEGORIES, custom, reload: reloadCategories } = useCategories();
  const [unknown, setUnknown] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<MerchantRecord | null>(null);
  const [newCategory, setNewCategory] = useState("");

  const load = useCallback(() => {
    api("/merchants/uncategorized").then(setUnknown).catch((e) => setError(e.message));
    api("/merchants?mine=1").then(setMine).catch(() => {});
  }, []);
  useEffect(load, [load]);

  // Assign a category to an unknown merchant: creates a Merchant entry whose
  // pattern is the merchant string, so every past + future transaction sorts.
  async function assign(merchant: string, category: string) {
    if (!category) return;
    setBusyKey(merchant);
    setMsg("");
    try {
      const res = await api<any>("/merchants", {
        method: "POST",
        body: JSON.stringify({
          name: titleCase(merchant),
          pattern: merchant.toLowerCase(),
          category,
          upsert: true, // re-assigning a merchant that already has a rule updates it
        }),
      });
      setMsg(`${titleCase(merchant)} → ${category}: ${res.recategorized} transaction${res.recategorized === 1 ? "" : "s"} sorted.`);
      load();
    } catch (err: any) {
      setMsg(`Couldn't save: ${err.message}`);
    } finally {
      setBusyKey("");
    }
  }

  async function remove(id: string) {
    await api(`/merchants/${id}`, { method: "DELETE" });
    load();
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCategory.trim()) return;
    setMsg("");
    try {
      const res = await api<any>("/categories", { method: "POST", body: JSON.stringify({ name: newCategory.trim() }) });
      setMsg(`Category "${res.name}" added — it's now available in every dropdown.`);
      setNewCategory("");
      reloadCategories();
    } catch (err: any) {
      setMsg(`Couldn't add category: ${err.message}`);
    }
  }

  async function removeCategory(id: string, name: string) {
    setMsg("");
    try {
      const res = await api<any>(`/categories/${id}`, { method: "DELETE" });
      setMsg(`Category "${name}" removed${res.reassignedTransactions ? ` — ${res.reassignedTransactions} transactions moved to Other` : ""}.`);
      reloadCategories();
      load();
    } catch (err: any) {
      setMsg(`Couldn't remove: ${err.message}`);
    }
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Merchants</h1>
        <button className="text-sm px-3 py-2 rounded-lg border border-hairline hover:bg-surface" onClick={() => setShowAdd(true)}>
          Add merchant manually
        </button>
      </div>
      <p className="text-sm text-ink-2 mb-4">
        These merchants aren't in the catalog yet. Pick a category once and every transaction from
        that merchant — past and future — is sorted automatically.
      </p>
      {msg && <p className="text-sm mb-3" style={{ color: "var(--delta-good-text)" }}>{msg}</p>}
      {error && <p className="text-sm mb-4" style={{ color: "var(--status-critical)" }}>⚠ {error}</p>}

      <div className="card overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-hairline">
              <th className="p-3 font-medium">Merchant</th>
              <th className="p-3 font-medium text-right">Transactions</th>
              <th className="p-3 font-medium text-right">Total spent</th>
              <th className="p-3 font-medium">Last seen</th>
              <th className="p-3 font-medium">Assign category</th>
            </tr>
          </thead>
          <tbody>
            {unknown.map((u) => (
              <tr key={u.merchant} className="border-b border-hairline last:border-0">
                <td className="p-3">
                  <p className="truncate max-w-xs">{titleCase(u.merchant)}</p>
                  <p className="text-xs text-muted truncate max-w-xs">{u.sample}</p>
                </td>
                <td className="p-3 text-right tabular-nums">{u.count}</td>
                <td className="p-3 text-right tabular-nums">{fmtCad(u.total)}</td>
                <td className="p-3 text-ink-2 whitespace-nowrap">{u.lastDate}</td>
                <td className="p-3">
                  <select
                    className="card px-2 py-1.5 cursor-pointer"
                    defaultValue=""
                    disabled={busyKey === u.merchant}
                    onChange={(e) => assign(u.merchant, e.target.value)}
                    aria-label={`Assign category for ${u.merchant}`}
                  >
                    <option value="" disabled>{busyKey === u.merchant ? "Saving…" : "Choose…"}</option>
                    {CATEGORIES.filter((c) => c !== "Other").map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {unknown.length === 0 && !error && (
          <p className="p-4 text-sm text-muted">🎉 Nothing uncategorized — every transaction has a known merchant.</p>
        )}
      </div>

      <h2 className="text-lg font-semibold mb-3">Your categories</h2>
      <div className="card p-4 mb-8">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {custom.map((c) => (
            <span key={c._docID} className="inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full border border-hairline">
              {c.name}
              <button className="text-muted hover:text-ink" title={`Remove ${c.name}`} onClick={() => removeCategory(c._docID, c.name)}>
                ×
              </button>
            </span>
          ))}
          {custom.length === 0 && <span className="text-sm text-muted">No custom categories yet — built-ins cover the basics.</span>}
        </div>
        <form onSubmit={addCategory} className="flex gap-2">
          <input
            className="card px-3 py-2 text-sm flex-1 max-w-xs"
            placeholder="New category, e.g. Kids, Pets, Travel"
            value={newCategory}
            maxLength={24}
            onChange={(e) => setNewCategory(e.target.value)}
          />
          <button className="text-sm px-4 py-2 rounded-lg font-semibold text-white" style={{ background: "var(--series-1)" }}>
            Add category
          </button>
        </form>
      </div>

      <h2 className="text-lg font-semibold mb-3">Your merchants</h2>
      <div className="flex flex-col gap-2">
        {mine.map((m) => (
          <div key={m._docID} className="card p-3 flex items-center gap-3 text-sm">
            <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ background: categoryColor(m.category) }} />
            <span className="font-medium">{m.name}</span>
            <span className="text-muted">matches “{m.pattern}”</span>
            <span className="text-ink-2">{m.category}</span>
            {(m.address || m.city) && <span className="text-muted truncate">{[m.address, m.city, m.province].filter(Boolean).join(", ")}</span>}
            <button className="ml-auto text-xs text-ink-2 hover:text-ink underline" onClick={() => setEditing(m)}>edit</button>
            <button className="text-xs text-muted hover:text-ink" onClick={() => remove(m._docID)}>remove</button>
          </div>
        ))}
        {mine.length === 0 && <p className="text-sm text-muted">No personal merchants yet — assign one above or add one manually.</p>}
      </div>

      {(showAdd || editing) && (
        <AddMerchant
          existing={editing ?? undefined}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          onAdded={(n) => {
            const verb = editing ? "updated" : "added";
            setShowAdd(false);
            setEditing(null);
            setMsg(`Merchant ${verb} — ${n} transaction${n === 1 ? "" : "s"} re-categorized.`);
            load();
          }}
        />
      )}
    </AppShell>
  );
}
