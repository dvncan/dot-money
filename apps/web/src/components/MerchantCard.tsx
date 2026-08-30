"use client";
import { useEffect, useState } from "react";
import { api, fmtCad } from "@/lib/api";
import { categoryColor } from "@/lib/colors";

interface MerchantStats {
  merchant: string;
  category: string;
  categories: string[];
  count: number;
  outflowCount: number;
  inflowCount: number;
  total: number;
  received: number;
  net: number;
  avg: number;
  perMonth: number;
  firstDate: string;
  lastDate: string;
}

/**
 * Spend summary for one merchant. Figures come from the API rollup over the
 * user's whole history, not just the rows currently loaded in the table.
 */
export default function MerchantCard({
  merchant,
  accountId,
  colors,
  onClear,
}: {
  merchant: string;
  accountId?: string;
  colors?: Record<string, string>;
  onClear?: () => void;
}) {
  const [stats, setStats] = useState<MerchantStats | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let live = true;
    setStats(null);
    setMissing(false);
    const qs = new URLSearchParams();
    if (accountId) qs.set("accountId", accountId);
    api<MerchantStats[]>(`/spending-analysis/merchants?${qs}`)
      .then((rows) => {
        if (!live) return;
        const hit = rows.find((r) => r.merchant === merchant);
        if (hit) setStats(hit);
        else setMissing(true);
      })
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
    };
  }, [merchant, accountId]);

  if (missing) return null;
  // a merchant that pays money back too (gambling, refunds, cashback) needs
  // its net shown — "money out" alone overstates what it actually cost
  const twoWay = Boolean(stats && stats.received > 0);

  return (
    <div className="card p-5 mb-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg font-semibold">{merchant}</h2>
          {stats && (
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-2 mt-1">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ background: categoryColor(stats.category, colors) }}
              />
              {stats.categories.join(", ")}
            </span>
          )}
        </div>
        {onClear && (
          <button className="text-xs text-muted hover:text-ink underline" onClick={onClear}>
            clear filter
          </button>
        )}
      </div>

      {!stats ? (
        <p className="text-sm text-muted">Loading spend…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted uppercase tracking-wide">Money out</p>
              <p className="text-2xl font-semibold mt-0.5">{fmtCad(stats.total)}</p>
              <p className="text-xs text-muted">{stats.outflowCount} payments</p>
            </div>
            {twoWay ? (
              <>
                <div>
                  <p className="text-xs text-muted uppercase tracking-wide">Money in</p>
                  <p className="text-2xl font-semibold mt-0.5" style={{ color: "var(--delta-good-text)" }}>
                    +{fmtCad(stats.received)}
                  </p>
                  <p className="text-xs text-muted">{stats.inflowCount} received</p>
                </div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-wide">Net</p>
                  <p
                    className="text-2xl font-semibold mt-0.5"
                    style={{ color: stats.net > 0 ? "var(--status-critical)" : "var(--delta-good-text)" }}
                  >
                    {stats.net >= 0 ? fmtCad(stats.net) : `+${fmtCad(-stats.net)}`}
                  </p>
                  <p className="text-xs text-muted">{stats.net >= 0 ? "down overall" : "up overall"}</p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-xs text-muted uppercase tracking-wide">Transactions</p>
                  <p className="text-2xl font-semibold mt-0.5">{stats.count}</p>
                </div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-wide">Average</p>
                  <p className="text-2xl font-semibold mt-0.5">{fmtCad(stats.avg)}</p>
                </div>
              </>
            )}
            <div>
              <p className="text-xs text-muted uppercase tracking-wide">Net per month</p>
              <p className="text-2xl font-semibold mt-0.5">{fmtCad(stats.perMonth)}</p>
            </div>
          </div>
          <p className="text-xs text-muted mt-3">
            First seen {stats.firstDate} · last seen {stats.lastDate}
            {twoWay && ` · average payment ${fmtCad(stats.avg)} across ${stats.count} transactions`}
          </p>
        </>
      )}
    </div>
  );
}
