"use client";
import { Fragment, useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import AddMerchant, { type MerchantRecord } from "@/components/AddMerchant";
import GeoMap from "@/components/GeoMap";
import { api, fmtCad } from "@/lib/api";
import { categoryColor } from "@/lib/colors";
import { useCategories } from "@/lib/useCategories";

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function MerchantsPage() {
  const { categories: CATEGORIES, styles, hidden, reload: reloadCategories } = useCategories();
  const [unknown, setUnknown] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<MerchantRecord | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [pickingFor, setPickingFor] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [hexDraft, setHexDraft] = useState("#888888");
  const [renameDraft, setRenameDraft] = useState("");

  const load = useCallback(() => {
    api("/merchants/uncategorized").then(setUnknown).catch((e) => setError(e.message));
    api("/merchants?mine=1").then(setMine).catch(() => {});
  }, []);
  useEffect(load, [load]);

  // Assign a category to an unknown merchant: creates a Merchant entry whose
  // pattern is the merchant string, so every past + future transaction sorts.
  // A transaction-provided location (Plaid) is saved as the merchant's address.
  async function assign(merchant: string, category: string, location?: string) {
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
          ...(location ? { address: location } : {}),
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

  async function setColor(category: string, color: string) {
    setMsg("");
    try {
      await api("/categories/style", { method: "POST", body: JSON.stringify({ category, color }) });
      reloadCategories();
      setPickingFor(null);
    } catch (err: any) {
      setMsg(`Couldn't set colour: ${err.message}`);
    }
  }

  async function removeCategory(name: string) {
    setMsg("");
    try {
      const res = await api<any>("/categories/delete", { method: "POST", body: JSON.stringify({ name }) });
      setMsg(
        `Category "${name}" ${res.hiddenBuiltin ? "hidden" : "removed"}` +
        (res.reassignedTransactions ? ` — ${res.reassignedTransactions} transactions moved to Other.` : ".")
      );
      if (pickingFor === name) setPickingFor(null);
      reloadCategories();
      load();
    } catch (err: any) {
      setMsg(`Couldn't remove: ${err.message}`);
    }
  }

  async function renameCategory(from: string, to: string) {
    if (!to.trim() || to.trim() === from) return;
    setMsg("");
    try {
      const res = await api<any>("/categories/rename", { method: "POST", body: JSON.stringify({ from, to: to.trim() }) });
      setMsg(`Renamed "${from}" → "${to.trim()}"${res.renamedTransactions ? ` (${res.renamedTransactions} transactions updated)` : ""}.`);
      setPickingFor(null);
      reloadCategories();
      load();
    } catch (err: any) {
      setMsg(`Couldn't rename: ${err.message}`);
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
              <Fragment key={u.merchant}>
                <tr
                  className="border-b border-hairline last:border-0 cursor-pointer hover:bg-plane"
                  onClick={() => setExpanded(expanded === u.merchant ? null : u.merchant)}
                  title="Click for details"
                >
                  <td className="p-3">
                    <p className="truncate max-w-xs">
                      <span className="text-muted mr-1">{expanded === u.merchant ? "▾" : "▸"}</span>
                      {titleCase(u.merchant)}
                    </p>
                    <p className="text-xs text-muted truncate max-w-xs">{u.sample}</p>
                  </td>
                  <td className="p-3 text-right tabular-nums">{u.count}</td>
                  <td className="p-3 text-right tabular-nums">{fmtCad(u.total)}</td>
                  <td className="p-3 text-ink-2 whitespace-nowrap">{u.lastDate}</td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <select
                      className="card px-2 py-1.5 cursor-pointer"
                      defaultValue=""
                      disabled={busyKey === u.merchant}
                      onChange={(e) => assign(u.merchant, e.target.value, u.location)}
                      aria-label={`Assign category for ${u.merchant}`}
                    >
                      <option value="" disabled>{busyKey === u.merchant ? "Saving…" : "Choose…"}</option>
                      {CATEGORIES.filter((c) => c !== "Other").map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                </tr>
                {expanded === u.merchant && (
                  <tr className="border-b border-hairline last:border-0">
                    <td colSpan={5} className="p-4" style={{ background: "var(--plane)" }}>
                      <div className="flex flex-wrap gap-4 text-sm mb-3">
                        <span><span className="text-muted">Transactions:</span> {u.count}</span>
                        <span><span className="text-muted">Total spent:</span> {fmtCad(u.total)}</span>
                        <span><span className="text-muted">Average:</span> {fmtCad(u.avg)}</span>
                        <span><span className="text-muted">First seen:</span> {u.firstDate}</span>
                        <span><span className="text-muted">Last seen:</span> {u.lastDate}</span>
                        {u.location && <span><span className="text-muted">Location:</span> {u.location}</span>}
                      </div>
                      <div className="flex flex-col gap-1">
                        {u.recent?.map((t: any, i: number) => (
                          <div key={i} className="flex gap-3 text-xs text-ink-2">
                            <span className="w-20 shrink-0 text-muted">{t.date}</span>
                            <span className="w-20 shrink-0 text-right tabular-nums">{fmtCad(Math.abs(t.amount))}</span>
                            <span className="truncate">{t.rawDescription}</span>
                          </div>
                        ))}
                      </div>
                      {/* only when the transaction actually carried a location */}
                      <GeoMap address={u.location} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {unknown.length === 0 && !error && (
          <p className="p-4 text-sm text-muted">🎉 Nothing uncategorized — every transaction has a known merchant.</p>
        )}
      </div>

      <h2 className="text-lg font-semibold mb-3">Your categories</h2>
      <div className="card p-4 mb-8">
        <p className="text-xs text-muted mb-3">Click a category's colour dot to edit its colour and name; × deletes it (its transactions move to Other). "Other" is the fallback bucket and stays put.</p>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {CATEGORIES.map((name) => (
            <span key={name} className="inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full border border-hairline">
              <button
                type="button"
                className="w-3.5 h-3.5 rounded-full border border-hairline shrink-0"
                style={{ background: categoryColor(name, styles) }}
                title={`Edit ${name}`}
                onClick={() => {
                  setPickingFor(pickingFor === name ? null : name);
                  setRenameDraft(name);
                }}
              />
              {name}
              {name !== "Other" && (
                <button type="button" className="text-muted hover:text-ink" title={`Delete ${name}`} onClick={() => removeCategory(name)}>
                  ×
                </button>
              )}
            </span>
          ))}
          {hidden.map((name) => (
            <span key={name} className="inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full border border-dashed border-hairline text-muted">
              {name}
              <button
                type="button"
                className="text-xs underline hover:text-ink"
                title={`Restore ${name}`}
                onClick={async () => {
                  await api("/categories/restore", { method: "POST", body: JSON.stringify({ name }) });
                  setMsg(`"${name}" restored.`);
                  reloadCategories();
                }}
              >
                restore
              </button>
            </span>
          ))}
        </div>

        {pickingFor && (
          <div className="border border-hairline rounded-lg p-3 mb-3 flex flex-wrap items-center gap-3">
            {pickingFor !== "Other" && (
              <span className="inline-flex items-center gap-1.5 text-sm text-ink-2 w-full">
                Name:
                <input
                  className="card px-2 py-1 text-sm w-44"
                  value={renameDraft}
                  maxLength={24}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); renameCategory(pickingFor, renameDraft); } }}
                />
                <button
                  type="button"
                  className="px-2 py-1 rounded border border-hairline text-xs"
                  disabled={!renameDraft.trim() || renameDraft.trim() === pickingFor}
                  onClick={() => renameCategory(pickingFor, renameDraft)}
                >
                  Rename
                </button>
              </span>
            )}
            <span className="text-sm text-ink-2">Colour for <strong>{pickingFor}</strong>:</span>
            <span className="inline-flex gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <button
                  key={n}
                  type="button"
                  className="w-6 h-6 rounded-full border border-hairline hover:scale-110 transition-transform"
                  style={{ background: `var(--series-${n})` }}
                  title={`Palette slot ${n}`}
                  onClick={() => setColor(pickingFor, `slot:${n}`)}
                />
              ))}
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm text-ink-2">
              <input type="color" className="w-8 h-8 cursor-pointer bg-transparent" value={hexDraft} onChange={(e) => setHexDraft(e.target.value)} />
              <button type="button" className="px-2 py-1 rounded border border-hairline text-xs" onClick={() => setColor(pickingFor, hexDraft)}>
                Use hex
              </button>
            </span>
            <button
              type="button"
              className="px-2 py-1 rounded border border-hairline text-xs"
              onClick={async () => {
                try {
                  const res = await api<any>("/categories/reset", { method: "POST", body: JSON.stringify({ name: pickingFor }) });
                  setMsg(res.renamed ? `Reset — back to "${res.name}" with its default colour.` : `Colour for "${res.name}" reset to default.`);
                  setPickingFor(null);
                  reloadCategories();
                  load();
                } catch (err: any) {
                  setMsg(`Couldn't reset: ${err.message}`);
                }
              }}
            >
              Reset to default
            </button>
            <button type="button" className="text-xs text-muted hover:text-ink ml-auto" onClick={() => setPickingFor(null)}>
              close
            </button>
          </div>
        )}

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
            <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ background: categoryColor(m.category, styles) }} />
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
