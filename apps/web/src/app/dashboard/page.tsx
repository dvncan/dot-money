"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import AccountPicker from "@/components/AccountPicker";
import { CategoryBars, StatTile, TrendChart } from "@/components/charts";
import { api, fmtCad } from "@/lib/api";
import { categoryColor } from "@/lib/colors";
import { useCategories } from "@/lib/useCategories";
import { useAccounts } from "@/lib/useAccounts";

const PRESETS: Record<"week" | "month", number[]> = {
  week: [4, 8, 12, 26, 52],
  month: [3, 6, 12, 24],
};

export default function DashboardPage() {
  const router = useRouter();
  const { categories, styles, dashboardHidden, setVisible } = useCategories();
  const { accounts, reload: reloadAccounts } = useAccounts();
  const [data, setData] = useState<any>(null);
  const [opps, setOpps] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<"week" | "month">("month");
  const [count, setCount] = useState(6);
  const [accountId, setAccountId] = useState("");
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);

  const load = useCallback(() => {
    const qs = new URLSearchParams({ period, count: String(count) });
    if (accountId) qs.set("accountId", accountId);
    api(`/spending-analysis/dashboard?${qs}`).then(setData).catch((e) => setError(e.message));
  }, [period, count, accountId]);
  useEffect(load, [load, dashboardHidden]);

  useEffect(() => {
    api("/spending-analysis/opportunities").then(setOpps).catch(() => {});
  }, []);

  const potential = opps.reduce((s, o) => s + (o.monthlySaving ?? 0), 0);
  const unit = period === "week" ? "week" : "month";
  const rangeLabel = count === 0 ? "all time" : `last ${count} ${unit}${count === 1 ? "" : "s"}`;
  const headline = period === "week" ? "This week" : "This month";

  function switchPeriod(next: "week" | "month") {
    setPeriod(next);
    setCount(next === "week" ? 8 : 6);
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <AccountPicker accounts={accounts} value={accountId} onChange={setAccountId} onRenamed={reloadAccounts} />
          <span className="inline-flex rounded-lg border border-hairline overflow-hidden">
            {(["week", "month"] as const).map((p) => (
              <button
                key={p}
                className="px-3 py-1.5 text-sm capitalize"
                style={
                  period === p
                    ? { background: "var(--series-1)", color: "#fff", fontWeight: 600 }
                    : { color: "var(--text-secondary)" }
                }
                onClick={() => switchPeriod(p)}
              >
                {p}ly
              </button>
            ))}
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm text-ink-2">
            last
            <input
              type="number"
              min={1}
              max={period === "week" ? 104 : 60}
              className="card px-2 py-1 w-16 text-sm"
              value={count === 0 ? "" : count}
              onChange={(e) => setCount(Math.max(0, Number(e.target.value) || 0))}
              aria-label={`Number of ${unit}s to show`}
            />
            {unit}s
          </span>
          <span className="inline-flex gap-1">
            {PRESETS[period].map((n) => (
              <button
                key={n}
                className="px-2 py-1 text-xs rounded border border-hairline"
                style={count === n ? { borderColor: "var(--series-1)", color: "var(--series-1)" } : undefined}
                onClick={() => setCount(n)}
              >
                {n}
              </button>
            ))}
            <button
              className="px-2 py-1 text-xs rounded border border-hairline"
              style={count === 0 ? { borderColor: "var(--series-1)", color: "var(--series-1)" } : undefined}
              onClick={() => setCount(0)}
            >
              All
            </button>
          </span>
        </div>
      </div>

      <div className="mb-4">
        <button
          className="text-sm text-ink-2 hover:text-ink underline"
          onClick={() => setShowCategoryPanel((v) => !v)}
        >
          {showCategoryPanel ? "Hide" : "Show"} category switches
          {dashboardHidden.length > 0 && ` (${dashboardHidden.length} off)`}
        </button>
        {showCategoryPanel && (
          <div className="card p-4 mt-2">
            <p className="text-xs text-muted mb-3">
              Switched-off categories are excluded from the totals, chart and breakdown below. They still
              categorize transactions everywhere else.
            </p>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => {
                const on = !dashboardHidden.includes(c);
                return (
                  <button
                    key={c}
                    role="switch"
                    aria-checked={on}
                    onClick={() => setVisible(c, !on)}
                    className="inline-flex items-center gap-2 text-sm pl-2.5 pr-2 py-1 rounded-full border"
                    style={{ borderColor: "var(--border-ring)", opacity: on ? 1 : 0.5 }}
                    title={on ? `Hide ${c} from the dashboard` : `Show ${c} on the dashboard`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                      style={{ background: categoryColor(c, styles) }}
                    />
                    {c}
                    {/* switch: filled + knob right when on, muted + knob left when off */}
                    <span
                      className="relative inline-block shrink-0 rounded-full transition-colors"
                      style={{
                        width: 26,
                        height: 15,
                        background: on ? "var(--series-1)" : "var(--baseline)",
                      }}
                    >
                      <span
                        className="absolute rounded-full transition-all"
                        style={{
                          width: 11,
                          height: 11,
                          top: 2,
                          left: on ? 13 : 2,
                          background: "var(--surface-1)",
                        }}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm mb-4" style={{ color: "var(--status-critical)" }}>⚠ {error}</p>}
      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatTile label={count === 0 ? "Spend · all time" : headline} value={fmtCad(data.monthSpend)} />
            <StatTile
              label={`Spend · ${rangeLabel}`}
              value={fmtCad(data.windowSpend)}
              hint={`${data.transactionCount} transactions`}
            />
            <StatTile
              label="Subscriptions"
              value={String(data.activeSubscriptions)}
              hint={`${fmtCad(data.subscriptionMonthlyCost)}/mo`}
            />
            <StatTile label="Potential savings" value={fmtCad(potential)} hint="per month, from opportunities" />
          </div>

          {data.totalReceived > 0 && (
            <p className="text-xs text-ink-2 mb-4">
              {fmtCad(data.windowSpend)} out and{" "}
              <span style={{ color: "var(--delta-good-text)" }}>+{fmtCad(data.totalReceived)} back in</span> from
              spending merchants (winnings, refunds, cashback) — net{" "}
              <strong>{fmtCad(data.windowSpend - data.totalReceived)}</strong> over {rangeLabel}.
            </p>
          )}

          {data.hiddenCategories?.length > 0 && (
            <p className="text-xs text-muted mb-4">
              Excluding {data.hiddenCategories.join(", ")} — {fmtCad(data.hiddenSpend)} hidden from these figures.
            </p>
          )}

          <div className="grid lg:grid-cols-2 gap-4 mb-6">
            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-3">
                Spend per {unit} — {rangeLabel}
              </h2>
              <TrendChart data={data.trend} />
            </div>
            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-1">By category — {rangeLabel}</h2>
              <p className="text-xs text-muted mb-3">
                Click a category to see its transactions. Categories with no spend in this period
                don&apos;t appear — widen the range or check the switches above.
              </p>
              <CategoryBars
                data={data.byCategory}
                colors={styles}
                onSelect={(category) =>
                  router.push(
                    `/transactions?category=${encodeURIComponent(category)}${accountId ? `&accountId=${accountId}` : ""}`
                  )
                }
              />
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
