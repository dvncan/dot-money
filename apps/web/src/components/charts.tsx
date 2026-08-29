"use client";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtCad } from "@/lib/api";
import { categoryColor } from "@/lib/colors";

/** Single-series spend trend: one hue, 2px line, crosshair tooltip, no legend
 *  (the card title names the series). */
export function TrendChart({ data }: { data: Array<{ month: string; total: number }> }) {
  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
          <CartesianGrid stroke="var(--hairline)" vertical={false} />
          <XAxis dataKey="month" stroke="var(--baseline)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} tickLine={false} />
          <YAxis stroke="var(--baseline)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} tickLine={false} axisLine={false} width={70}
            tickFormatter={(v: number) => fmtCad(v).replace(".00", "")} />
          <Tooltip
            cursor={{ stroke: "var(--baseline)", strokeWidth: 1 }}
            formatter={(value) => [fmtCad(Number(value)), "Spend"]}
            contentStyle={{ background: "var(--surface-1)", border: "1px solid var(--border-ring)", borderRadius: 8, color: "var(--text-primary)" }}
          />
          <Line type="monotone" dataKey="total" stroke="var(--series-1)" strokeWidth={2}
            dot={{ r: 3, fill: "var(--series-1)", stroke: "var(--surface-1)", strokeWidth: 2 }}
            activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Category breakdown as labeled horizontal bars. Color follows the category
 *  (fixed slot map), never its rank; every bar carries a direct label so
 *  identity never rides on color alone. */
export function CategoryBars({ data }: { data: Array<{ category: string; total: number }> }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div className="flex flex-col gap-2">
      {data.map((d) => (
        <div key={d.category} className="grid items-center gap-2" style={{ gridTemplateColumns: "110px 1fr 90px" }}>
          <span className="text-sm text-ink-2 truncate">{d.category}</span>
          <div className="h-4 rounded" style={{ background: "var(--plane)" }} title={`${d.category}: ${fmtCad(d.total)}`}>
            <div
              className="h-4 rounded"
              style={{
                width: `${Math.max((d.total / max) * 100, 2)}%`,
                background: categoryColor(d.category),
                borderRadius: "4px",
              }}
            />
          </div>
          <span className="text-sm text-right tabular-nums">{fmtCad(d.total)}</span>
        </div>
      ))}
      {data.length === 0 && <p className="text-sm text-muted">No spending this month yet.</p>}
    </div>
  );
}

/** Budget meter using reserved status colors, always paired with a text label. */
export function BudgetMeter({ pct }: { pct: number }) {
  const color =
    pct >= 100 ? "var(--status-critical)" : pct >= 90 ? "var(--status-serious)" : pct >= 80 ? "var(--status-warning)" : "var(--status-good)";
  const label = pct >= 100 ? "Over budget" : pct >= 80 ? "Approaching limit" : "On track";
  return (
    <div>
      <div className="h-3 rounded" style={{ background: "var(--plane)" }}>
        <div className="h-3 rounded" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <p className="text-xs mt-1 text-ink-2">
        {pct}% used — {label}
      </p>
    </div>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
      {hint && <p className="text-xs text-ink-2 mt-1">{hint}</p>}
    </div>
  );
}
