"use client";
import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import ConnectBank from "@/components/ConnectBank";
import AddMerchant from "@/components/AddMerchant";
import { api, fmtCad } from "@/lib/api";
import { categoryColor } from "@/lib/colors";
import { useCategories } from "@/lib/useCategories";

export default function TransactionsPage() {
  const { categories: CATEGORIES } = useCategories();
  const [txns, setTxns] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState("");
  const [showAddMerchant, setShowAddMerchant] = useState(false);

  const load = useCallback(() => {
    api("/transactions?limit=200").then(setTxns).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function onCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setMsg("");
    try {
      const csv = await file.text();
      const res = await api<any>("/banks/import-csv", {
        method: "POST",
        body: JSON.stringify({ csv, label: file.name.replace(/\.csv$/i, "") }),
      });
      setMsg(`Imported ${res.imported} transactions (${res.skipped} skipped).`);
      load();
    } catch (err: any) {
      setMsg(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  // Change one transaction's category. Budgets/dashboard recompute from
  // transactions on read, so they reflect this on their next fetch.
  async function setCategory(id: string, category: string) {
    const prev = txns;
    setTxns(txns.map((t) => (t._docID === id ? { ...t, category } : t)));
    try {
      await api(`/transactions/${id}`, { method: "PATCH", body: JSON.stringify({ category }) });
    } catch (err: any) {
      setTxns(prev); // roll back on failure
      setMsg(`Couldn't update category: ${err.message}`);
    }
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <div className="flex items-center gap-3">
          <ConnectBank onLinked={load} />
          <button
            className="text-sm px-3 py-2 rounded-lg border border-hairline hover:bg-surface"
            onClick={() => setShowAddMerchant(true)}
          >
            Add merchant
          </button>
          <label className="text-sm px-3 py-2 rounded-lg border border-hairline cursor-pointer hover:bg-surface">
            {importing ? "Importing…" : "Import bank CSV"}
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onCsvFile} disabled={importing} />
          </label>
        </div>
      </div>
      <p className="text-sm text-ink-2 mb-4">
        Categories come from the merchant catalog — fix one with the dropdown, or teach the app a
        local merchant with “Add merchant” and every matching transaction re-categorizes.
      </p>
      {msg && <p className="text-sm mb-3 text-ink-2">{msg}</p>}
      {error && <p className="text-sm mb-4" style={{ color: "var(--status-critical)" }}>⚠ {error}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-hairline">
              <th className="p-3 font-medium">Date</th>
              <th className="p-3 font-medium">Merchant</th>
              <th className="p-3 font-medium">Category</th>
              <th className="p-3 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {txns.map((t) => (
              <tr key={t._docID} className="border-b border-hairline last:border-0">
                <td className="p-3 whitespace-nowrap text-ink-2">{t.date}</td>
                <td className="p-3">
                  <p className="truncate max-w-xs">{t.merchant}</p>
                  <p className="text-xs text-muted truncate max-w-xs">{t.rawDescription}</p>
                </td>
                <td className="p-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ background: categoryColor(t.category) }} />
                    <select
                      className="bg-transparent border border-transparent hover:border-hairline focus:border-hairline rounded px-1 py-0.5 text-sm cursor-pointer"
                      value={CATEGORIES.includes(t.category) ? t.category : "Other"}
                      onChange={(e) => setCategory(t._docID, e.target.value)}
                      aria-label={`Category for ${t.merchant}`}
                    >
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </span>
                </td>
                <td className="p-3 text-right tabular-nums" style={t.amount < 0 ? { color: "var(--delta-good-text)" } : undefined}>
                  {t.amount < 0 ? `+${fmtCad(-t.amount)}` : fmtCad(t.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {txns.length === 0 && !error && <p className="p-4 text-sm text-muted">No transactions yet.</p>}
      </div>

      {showAddMerchant && (
        <AddMerchant
          onClose={() => setShowAddMerchant(false)}
          onAdded={(recategorized) => {
            setShowAddMerchant(false);
            setMsg(`Merchant added — ${recategorized} transaction${recategorized === 1 ? "" : "s"} re-categorized.`);
            load();
          }}
        />
      )}
    </AppShell>
  );
}
