"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { CategoryBars, StatTile, TrendChart } from "@/components/charts";
import { api, fmtCad } from "@/lib/api";

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [opps, setOpps] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/spending-analysis/dashboard").then(setData).catch((e) => setError(e.message));
    api("/spending-analysis/opportunities").then(setOpps).catch(() => {});
  }, []);

  const potential = opps.reduce((s, o) => s + (o.monthlySaving ?? 0), 0);

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>
      {error && <p className="text-sm mb-4" style={{ color: "var(--status-critical)" }}>⚠ {error}</p>}
      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatTile label="Spend this month" value={fmtCad(data.monthSpend)} />
            <StatTile label="Active subscriptions" value={String(data.activeSubscriptions)} />
            <StatTile label="Subscription cost" value={fmtCad(data.subscriptionMonthlyCost)} hint="per month" />
            <StatTile label="Potential savings" value={fmtCad(potential)} hint="per month, from opportunities" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4 mb-6">
            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-3">Monthly spend — last 6 months</h2>
              <TrendChart data={data.trend} />
            </div>
            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-3">This month by category</h2>
              <CategoryBars data={data.byCategory} />
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold mb-3">Recommended actions</h2>
            {opps.length === 0 && <p className="text-sm text-muted">Nothing flagged right now — nice.</p>}
            <ul className="flex flex-col gap-2">
              {opps.map((o, i) => (
                <li key={i} className="text-sm flex gap-2">
                  <span aria-hidden>{o.kind === "duplicate" ? "🔁" : "💤"}</span>
                  <span className="text-ink-2">{o.message}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </AppShell>
  );
}
