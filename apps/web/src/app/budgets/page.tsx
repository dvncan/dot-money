"use client";
import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { BudgetMeter } from "@/components/charts";
import { api, fmtCad } from "@/lib/api";
import { useCategories } from "@/lib/useCategories";

export default function BudgetsPage() {
  const { categories } = useCategories();
  const CATEGORIES = categories.filter((c) => c !== "Income");
  const [budgets, setBudgets] = useState<any[]>([]);
  const [category, setCategory] = useState("Groceries");
  const [limit, setLimit] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api("/budgets").then(setBudgets).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/budgets", { method: "POST", body: JSON.stringify({ category, limit: Number(limit) }) });
      setLimit("");
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function remove(id: string) {
    await api(`/budgets/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold mb-6">Budgets</h1>

      <form onSubmit={add} className="card p-4 flex items-end gap-3 mb-6 flex-wrap">
        <label className="text-sm text-ink-2 flex flex-col gap-1">
          Category
          <select className="card px-3 py-2" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="text-sm text-ink-2 flex flex-col gap-1">
          Monthly limit (CAD)
          <input className="card px-3 py-2 w-36" type="number" min="1" step="0.01" required value={limit} onChange={(e) => setLimit(e.target.value)} />
        </label>
        <button className="px-4 py-2 rounded-lg font-semibold text-white text-sm" style={{ background: "var(--series-1)" }}>
          Add budget
        </button>
        {error && <p className="text-sm w-full" style={{ color: "var(--status-critical)" }}>⚠ {error}</p>}
      </form>

      <div className="grid md:grid-cols-2 gap-4">
        {budgets.map((b) => (
          <div key={b._docID} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="font-medium">{b.category}</p>
              <button className="text-xs text-muted hover:text-ink" onClick={() => remove(b._docID)}>remove</button>
            </div>
            <p className="text-sm text-ink-2 mb-2">
              {fmtCad(b.spent)} of {fmtCad(b.limit)} — {fmtCad(Math.max(b.remaining, 0))} left
            </p>
            <BudgetMeter pct={b.pct} />
          </div>
        ))}
        {budgets.length === 0 && <p className="text-sm text-muted">No budgets yet — add one above.</p>}
      </div>
    </AppShell>
  );
}
