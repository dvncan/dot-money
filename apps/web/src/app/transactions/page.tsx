"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import ConnectBank from "@/components/ConnectBank";
import AddMerchant from "@/components/AddMerchant";
import AccountPicker from "@/components/AccountPicker";
import MerchantCard from "@/components/MerchantCard";
import { api, fmtCad } from "@/lib/api";
import { categoryColor } from "@/lib/colors";
import { useCategories } from "@/lib/useCategories";
import { useAccounts } from "@/lib/useAccounts";

export default function TransactionsPage() {
  // useSearchParams needs a Suspense boundary in a prerendered client page
  return (
    <Suspense fallback={null}>
      <TransactionsView />
    </Suspense>
  );
}

function TransactionsView() {
  const searchParams = useSearchParams();
  const { categories: CATEGORIES, styles } = useCategories();
  const { accounts, reload: reloadAccounts } = useAccounts();
  const [txns, setTxns] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState("");
  const [showAddMerchant, setShowAddMerchant] = useState(false);

  // filters & sorting (applied client-side for instant response).
  // Category/merchant/account can arrive as query params — e.g. clicking a
  // category on the dashboard deep-links into this filtered view.
  const [fCategory, setFCategory] = useState(searchParams.get("category") ?? "All");
  const [fMerchant, setFMerchant] = useState(searchParams.get("merchant") ?? "All");
  const [fRange, setFRange] = useState<"all" | "month" | "30" | "90">("all");
  const [fSearch, setFSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "amount-desc" | "amount-asc" | "merchant">("date-desc");

  const [fAccount, setFAccount] = useState(searchParams.get("accountId") ?? "");

  const load = useCallback(() => {
    const qs = new URLSearchParams({ limit: "500" });
    if (fAccount) qs.set("accountId", fAccount);
    api(`/transactions?${qs}`).then(setTxns).catch((e) => setError(e.message));
  }, [fAccount]);
  useEffect(load, [load]);

  // merchants present in the loaded set, for the merchant filter
  const merchantOptions = useMemo(
    () => [...new Set(txns.map((t) => t.merchant).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [txns]
  );

  const visible = useMemo(() => {
    let list = [...txns];
    if (fCategory !== "All") list = list.filter((t) => t.category === fCategory);
    if (fMerchant !== "All") list = list.filter((t) => t.merchant === fMerchant);
    if (fRange !== "all") {
      let cutoff: string;
      if (fRange === "month") {
        const d = new Date();
        cutoff = `${d.toISOString().slice(0, 7)}-01`;
      } else {
        cutoff = new Date(Date.now() - Number(fRange) * 86_400_000).toISOString().slice(0, 10);
      }
      list = list.filter((t) => t.date >= cutoff);
    }
    if (fSearch.trim()) {
      const q = fSearch.trim().toLowerCase();
      list = list.filter((t) => `${t.merchant} ${t.rawDescription}`.toLowerCase().includes(q));
    }
    const cmp: Record<typeof sortBy, (a: any, b: any) => number> = {
      "date-desc": (a, b) => b.date.localeCompare(a.date),
      "date-asc": (a, b) => a.date.localeCompare(b.date),
      "amount-desc": (a, b) => b.amount - a.amount,
      "amount-asc": (a, b) => a.amount - b.amount,
      merchant: (a, b) => a.merchant.localeCompare(b.merchant) || b.date.localeCompare(a.date),
    };
    return list.sort(cmp[sortBy]);
  }, [txns, fCategory, fMerchant, fRange, fSearch, sortBy]);

  const visibleSpend = useMemo(
    () => visible.reduce((s, t) => (t.amount > 0 ? s + t.amount : s), 0),
    [visible]
  );
  // money coming back in the current view (winnings, refunds, cashback)
  const visibleReceived = useMemo(
    () => visible.reduce((s, t) => (t.amount < 0 ? s + Math.abs(t.amount) : s), 0),
    [visible]
  );

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

  async function remove(id: string) {
    const prev = txns;
    setTxns(txns.filter((t) => t._docID !== id)); // optimistic
    try {
      await api(`/transactions/${id}`, { method: "DELETE" });
      reloadAccounts();
    } catch (err: any) {
      setTxns(prev);
      setMsg(`Couldn't delete: ${err.message}`);
    }
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold">Transactions</h1>
          <AccountPicker accounts={accounts} value={fAccount} onChange={setFAccount} onRenamed={reloadAccounts} />
        </div>
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

      {fMerchant !== "All" && (
        <MerchantCard
          merchant={fMerchant}
          accountId={fAccount}
          colors={styles}
          onClear={() => setFMerchant("All")}
        />
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-hairline">
              <th className="p-3 font-medium whitespace-nowrap">
                <button
                  className="hover:text-ink"
                  title="Sort by date"
                  onClick={() => setSortBy(sortBy === "date-desc" ? "date-asc" : "date-desc")}
                >
                  Date {sortBy === "date-desc" ? "↓" : sortBy === "date-asc" ? "↑" : ""}
                </button>{" "}
                <select
                  className="bg-transparent border border-hairline rounded px-1 py-0.5 text-xs cursor-pointer"
                  value={fRange}
                  onChange={(e) => setFRange(e.target.value as any)}
                  aria-label="Date range filter"
                >
                  <option value="all">All time</option>
                  <option value="month">This month</option>
                  <option value="30">Last 30d</option>
                  <option value="90">Last 90d</option>
                </select>
              </th>
              <th className="p-3 font-medium whitespace-nowrap">
                <button
                  className="hover:text-ink"
                  title="Sort by merchant A–Z"
                  onClick={() => setSortBy("merchant")}
                >
                  Merchant {sortBy === "merchant" ? "↓" : ""}
                </button>{" "}
                <select
                  className="bg-transparent border border-hairline rounded px-1 py-0.5 text-xs cursor-pointer max-w-[10rem]"
                  value={fMerchant}
                  onChange={(e) => setFMerchant(e.target.value)}
                  aria-label="Filter by merchant"
                >
                  <option value="All">All merchants</option>
                  {merchantOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>{" "}
                <input
                  className="bg-transparent border border-hairline rounded px-1.5 py-0.5 text-xs w-24 font-normal"
                  placeholder="search…"
                  value={fSearch}
                  onChange={(e) => setFSearch(e.target.value)}
                  aria-label="Search merchant or description"
                />
              </th>
              <th className="p-3 font-medium whitespace-nowrap">
                Category{" "}
                <select
                  className="bg-transparent border border-hairline rounded px-1 py-0.5 text-xs cursor-pointer"
                  value={fCategory}
                  onChange={(e) => setFCategory(e.target.value)}
                  aria-label="Category filter"
                >
                  <option>All</option>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </th>
              <th className="p-3 font-medium text-right whitespace-nowrap">
                <button
                  className="hover:text-ink"
                  title="Sort by amount"
                  onClick={() => setSortBy(sortBy === "amount-desc" ? "amount-asc" : "amount-desc")}
                >
                  Amount {sortBy === "amount-desc" ? "↓" : sortBy === "amount-asc" ? "↑" : ""}
                </button>
              </th>
              <th className="p-3 font-medium w-8" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => (
              <tr key={t._docID} className="border-b border-hairline last:border-0">
                <td className="p-3 whitespace-nowrap text-ink-2">{t.date}</td>
                <td className="p-3">
                  <button
                    className="truncate max-w-xs text-left hover:underline"
                    title={`Show spend with ${t.merchant}`}
                    onClick={() => setFMerchant(t.merchant)}
                  >
                    {t.merchant}
                  </button>
                  <p className="text-xs text-muted truncate max-w-xs">{t.rawDescription}</p>
                </td>
                <td className="p-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ background: categoryColor(t.category, styles) }} />
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
                <td className="p-3 text-right">
                  <button
                    className="text-muted hover:text-ink"
                    title={`Delete ${t.merchant} — ${t.date}`}
                    onClick={() => remove(t._docID)}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && !error && (
          <p className="p-4 text-sm text-muted">
            {txns.length === 0 ? "No transactions yet." : "Nothing matches the current filters."}
          </p>
        )}
      </div>
      {visible.length > 0 && (
        <p className="text-xs text-muted mt-2">
          {visible.length} transaction{visible.length === 1 ? "" : "s"} · {fmtCad(visibleSpend)} out
          {visibleReceived > 0 && (
            <>
              {" · "}
              <span style={{ color: "var(--delta-good-text)" }}>+{fmtCad(visibleReceived)} in</span>
              {" · "}net {fmtCad(visibleSpend - visibleReceived)}
            </>
          )}
          {(fCategory !== "All" || fMerchant !== "All" || fRange !== "all" || fSearch.trim()) && (
            <button
              className="ml-2 underline hover:text-ink"
              onClick={() => { setFCategory("All"); setFMerchant("All"); setFRange("all"); setFSearch(""); }}
            >
              clear filters
            </button>
          )}
        </p>
      )}

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
