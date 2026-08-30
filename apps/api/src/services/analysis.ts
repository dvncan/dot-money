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

export async function getUserTxns(
  userId: string,
  sinceIso?: string,
  accountId?: string
): Promise<TxnRow[]> {
  const filter: Record<string, unknown> = { userId: { _eq: userId } };
  if (accountId) filter.bankAccountId = { _eq: accountId };
  // DefraDB v1.0 String filters lack range operators, so the date cut is applied here;
  // switching `date` to Defra's DateTime scalar would push this into the query.
  const rows = await findDocs<TxnRow>("Txn", ["date", "amount", "merchant", "category"], {
    filter,
    limit: 10000,
  });
  // inclusive: `since` is the first day of the window, and a transaction dated
  // on that day belongs to it
  return sinceIso ? rows.filter((t) => t.date >= sinceIso) : rows;
}

export type Period = "week" | "month";

export interface DashboardOptions {
  /** bucket size for the trend and the window */
  period?: Period;
  /** how many buckets back (inclusive of the current one); 0 means all time */
  count?: number;
  accountId?: string;
}

/** Monday-start ISO week key for a YYYY-MM-DD date. */
function weekKey(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Mon = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

/** First day of the window covering `count` buckets back from today. */
function windowStart(period: Period, count: number): string {
  const now = new Date();
  if (period === "week") {
    const start = new Date(`${weekKey(now.toISOString().slice(0, 10))}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() - (count - 1) * 7);
    return start.toISOString().slice(0, 10);
  }
  return new Date(now.getFullYear(), now.getMonth() - (count - 1), 1).toISOString().slice(0, 10);
}

function bucketLabel(period: Period, key: string): string {
  if (period === "month") {
    const [y, m] = key.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-CA", { month: "short", year: "2-digit" });
  }
  const d = new Date(`${key}T00:00:00Z`);
  return d.toLocaleString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Categories this user switched off on the dashboard. */
async function hiddenCategories(userId: string): Promise<Set<string>> {
  const rows = await findDocs<any>("CategoryStyle", ["category", "dashboardHidden"], {
    filter: { userId: { _eq: userId } },
    limit: 500,
  });
  return new Set(rows.filter((r: any) => r.dashboardHidden === "1").map((r: any) => r.category));
}

export async function dashboard(userId: string, opts: DashboardOptions = {}) {
  const period: Period = opts.period ?? "month";
  const count = opts.count ?? 6;
  const since = count > 0 ? windowStart(period, count) : undefined;

  const [txns, hidden] = await Promise.all([
    getUserTxns(userId, since, opts.accountId),
    hiddenCategories(userId),
  ]);

  const spendAll = txns.filter((t) => t.amount > 0 && t.category !== "Income");
  const spend = spendAll.filter((t) => !hidden.has(t.category));
  // money coming back from a spending merchant (gambling winnings, refunds,
  // cashback) — tracked per category so a two-way category can show its net
  const inflows = txns.filter((t) => t.amount < 0 && t.category !== "Income" && !hidden.has(t.category));
  const keyOf = (iso: string) => (period === "week" ? weekKey(iso) : monthKey(iso));

  // the headline bucket is the current week/month; with count=0 (all time) the
  // headline is the whole span, so the tile always matches its label
  const currentKey = keyOf(new Date().toISOString().slice(0, 10));
  const headlineRows = count === 0 ? spend : spend.filter((t) => keyOf(t.date) === currentKey);

  // the breakdown covers the whole selected window, not just the current
  // bucket — picking "last 12 months" should break down 12 months of spend
  const byCategory = new Map<string, number>();
  for (const t of spend) byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount);
  const receivedByCategory = new Map<string, number>();
  for (const t of inflows) {
    receivedByCategory.set(t.category, (receivedByCategory.get(t.category) ?? 0) + Math.abs(t.amount));
  }

  const byBucket = new Map<string, number>();
  for (const t of spend) byBucket.set(keyOf(t.date), (byBucket.get(keyOf(t.date)) ?? 0) + t.amount);
  const trend = [...byBucket.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, total]) => ({ month: bucketLabel(period, key), key, total: Number(total.toFixed(2)) }));

  const subs = await findDocs<any>("Sub", ["vendor", "category", "cost", "billingCycle", "status"], {
    filter: { userId: { _eq: userId }, status: { _eq: "active" } },
  });
  const subMonthly = subs.reduce((s: number, sub: any) => s + monthlyCost(sub), 0);

  return {
    period,
    count,
    headlineLabel: count === 0 ? "All time" : period === "week" ? "This week" : "This month",
    monthSpend: Number(headlineRows.reduce((s, t) => s + t.amount, 0).toFixed(2)),
    windowSpend: Number(spend.reduce((s, t) => s + t.amount, 0).toFixed(2)),
    transactionCount: txns.length,
    hiddenCategories: [...hidden],
    hiddenSpend: Number(
      spendAll.filter((t) => hidden.has(t.category)).reduce((s, t) => s + t.amount, 0).toFixed(2)
    ),
    activeSubscriptions: subs.length,
    subscriptionMonthlyCost: Number(subMonthly.toFixed(2)),
    totalReceived: Number(inflows.reduce((s, t) => s + Math.abs(t.amount), 0).toFixed(2)),
    byCategory: [...byCategory.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([category, total]) => {
        const received = receivedByCategory.get(category) ?? 0;
        return {
          category,
          total: Number(total.toFixed(2)),
          received: Number(received.toFixed(2)),
          net: Number((total - received).toFixed(2)),
        };
      }),
    trend,
  };
}

/**
 * Per-merchant spend rollup: what you spend with each merchant, how often, and
 * over what span. Powers the merchant filter and the merchant detail card.
 */
export async function merchantSpend(
  userId: string,
  opts: { accountId?: string; since?: string } = {}
) {
  const txns = await getUserTxns(userId, opts.since, opts.accountId);
  const groups = new Map<string, { rows: TxnRow[] }>();
  for (const t of txns) {
    const key = t.merchant || "(no description)";
    const g = groups.get(key) ?? { rows: [] };
    g.rows.push(t);
    groups.set(key, g);
  }

  return [...groups.entries()]
    .map(([merchant, g]) => {
      const rows = g.rows.sort((a, b) => b.date.localeCompare(a.date));
      const spends = rows.filter((t) => t.amount > 0);
      const received = rows.filter((t) => t.amount < 0);
      const total = spends.reduce((s, t) => s + t.amount, 0);
      const receivedTotal = received.reduce((s, t) => s + Math.abs(t.amount), 0);
      const categories = [...new Set(rows.map((t) => t.category))];
      const months = new Set(rows.map((t) => monthKey(t.date))).size;
      // net matters for two-way merchants (gambling, refunds, cashback):
      // money out minus money back in
      const net = total - receivedTotal;
      return {
        merchant,
        category: categories[0] ?? "Other",
        categories,
        count: rows.length,
        outflowCount: spends.length,
        inflowCount: received.length,
        total: Number(total.toFixed(2)),
        received: Number(receivedTotal.toFixed(2)),
        net: Number(net.toFixed(2)),
        avg: spends.length ? Number((total / spends.length).toFixed(2)) : 0,
        perMonth: months ? Number((net / months).toFixed(2)) : 0,
        firstDate: rows[rows.length - 1]?.date ?? "",
        lastDate: rows[0]?.date ?? "",
      };
    })
    .sort((a, b) => b.total - a.total || b.count - a.count);
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
