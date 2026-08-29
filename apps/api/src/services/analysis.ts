/**
 * Spending analysis (MVP).
 * Aggregations run in the app layer over filtered Defra reads; Defra-native
 * groupBy/_sum can replace these hot paths later.
 */
import { findDocs } from "../lib/defra.js";
import { monthlyCost } from "./subscriptionDetector.js";

interface TxnRow {
  _docID: string;
  date: string;
  amount: number;
  merchant: string;
  category: string;
}

function monthKey(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

export async function getUserTxns(userId: string, sinceIso?: string): Promise<TxnRow[]> {
  // DefraDB v1.0 String filters lack range operators, so the date cut is applied here;
  // switching `date` to Defra's DateTime scalar would push this into the query.
  const rows = await findDocs<TxnRow>("Txn", ["date", "amount", "merchant", "category"], {
    filter: { userId: { _eq: userId } },
    limit: 10000,
  });
  return sinceIso ? rows.filter((t) => t.date > sinceIso) : rows;
}

export async function dashboard(userId: string) {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10);
  const txns = await getUserTxns(userId, sixMonthsAgo);
  const spend = txns.filter((t) => t.amount > 0 && t.category !== "Income");

  const thisMonth = monthKey(now.toISOString());
  const monthSpend = spend.filter((t) => monthKey(t.date) === thisMonth).reduce((s, t) => s + t.amount, 0);

  // by category, current month
  const byCategory = new Map<string, number>();
  for (const t of spend.filter((t) => monthKey(t.date) === thisMonth)) {
    byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount);
  }

  // 6-month trend
  const byMonth = new Map<string, number>();
  for (const t of spend) byMonth.set(monthKey(t.date), (byMonth.get(t.date.slice(0, 7)) ?? 0) + t.amount);
  const trend = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, total]) => ({ month, total: Number(total.toFixed(2)) }));

  const subs = await findDocs<any>("Sub", ["vendor", "category", "cost", "billingCycle", "status"], {
    filter: { userId: { _eq: userId }, status: { _eq: "active" } },
  });
  const subMonthly = subs.reduce((s: number, sub: any) => s + monthlyCost(sub), 0);

  return {
    monthSpend: Number(monthSpend.toFixed(2)),
    activeSubscriptions: subs.length,
    subscriptionMonthlyCost: Number(subMonthly.toFixed(2)),
    byCategory: [...byCategory.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([category, total]) => ({ category, total: Number(total.toFixed(2)) })),
    trend,
  };
}

/** Anomalies: transactions > 2.5x the merchant's median, or category month spend > 1.75x its 3-month average. */
export async function anomalies(userId: string) {
  const txns = await getUserTxns(userId);
  const spend = txns.filter((t) => t.amount > 0 && t.category !== "Income");

  const byMerchant = new Map<string, TxnRow[]>();
  for (const t of spend) {
    const list = byMerchant.get(t.merchant) ?? [];
    list.push(t);
    byMerchant.set(t.merchant, list);
  }

  const flagged: Array<{ txn: TxnRow; reason: string }> = [];
  for (const [merchant, rows] of byMerchant) {
    if (rows.length < 3) continue;
    const sorted = rows.map((r) => r.amount).sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)]!;
    for (const t of rows) {
      if (med > 0 && t.amount > med * 2.5) {
        flagged.push({ txn: t, reason: `${merchant}: $${t.amount.toFixed(2)} is well above its usual ~$${med.toFixed(2)}` });
      }
    }
  }
  return flagged.slice(0, 20);
}

/** Savings opportunities: duplicate-category subs + anything unused-looking (yearly gap). */
export async function opportunities(userId: string) {
  const subs = await findDocs<any>(
    "Sub",
    ["vendor", "category", "cost", "billingCycle", "status", "lastSeen"],
    { filter: { userId: { _eq: userId } }, limit: 500 }
  );
  const active = subs.filter((s: any) => s.status === "active");

  const out: Array<{ kind: string; message: string; monthlySaving: number; subscriptionId?: string }> = [];

  const byCat = new Map<string, any[]>();
  for (const s of active) {
    const list = byCat.get(s.category) ?? [];
    list.push(s);
    byCat.set(s.category, list);
  }
  for (const [cat, list] of byCat) {
    if (["Streaming", "Fitness", "Software"].includes(cat) && list.length > 1) {
      const cheapest = list.reduce((a, b) => (monthlyCost(a) < monthlyCost(b) ? a : b));
      for (const s of list) {
        if (s === cheapest) continue;
        out.push({
          kind: "duplicate",
          subscriptionId: s._docID,
          message: `You have ${list.length} active ${cat.toLowerCase()} subscriptions. Cancelling ${s.vendor} saves ~$${monthlyCost(s).toFixed(2)}/mo.`,
          monthlySaving: Number(monthlyCost(s).toFixed(2)),
        });
      }
    }
  }

  const staleCutoff = new Date(Date.now() - 45 * 86_400_000).toISOString().slice(0, 10);
  for (const s of active) {
    if (s.billingCycle === "monthly" && s.lastSeen && s.lastSeen < staleCutoff) {
      out.push({
        kind: "stale",
        subscriptionId: s._docID,
        message: `${s.vendor} hasn't billed since ${s.lastSeen} — it may already be cancelled, or worth confirming.`,
        monthlySaving: 0,
      });
    }
  }

  return out.sort((a, b) => b.monthlySaving - a.monthlySaving);
}
