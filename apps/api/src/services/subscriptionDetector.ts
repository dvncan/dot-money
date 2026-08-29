/**
 * Subscription detection (MVP heuristic).
 *
 * Groups a user's outgoing transactions by normalized merchant, then looks for
 * regular billing intervals with consistent amounts:
 *   weekly  ~7d  (±2), monthly ~28–33d (±4), yearly ~365d (±15)
 * Requires >= 2 occurrences (>= 3 for weekly) and amount variance <= 15%.
 *
 * Also flags likely duplicates: two active subscriptions in the same
 * "duplicate-prone" category (e.g. multiple streaming services).
 */
import { findDocs, createDoc, updateDoc } from "../lib/defra.js";
import { categorize } from "./categorizer.js";

interface TxnRow {
  _docID: string;
  date: string;
  amount: number;
  merchant: string;
  category: string;
}

interface DetectedSub {
  vendor: string;
  category: string;
  cost: number;
  billingCycle: "weekly" | "monthly" | "yearly";
  firstSeen: string;
  lastSeen: string;
  nextBillingDate: string;
  occurrences: number;
}

const DUPLICATE_PRONE = new Set(["Streaming", "Fitness", "Software"]);

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function classifyInterval(days: number): DetectedSub["billingCycle"] | null {
  if (days >= 5 && days <= 9) return "weekly";
  if (days >= 24 && days <= 37) return "monthly";
  if (days >= 350 && days <= 380) return "yearly";
  return null;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const CYCLE_DAYS = { weekly: 7, monthly: 30, yearly: 365 } as const;

export function detectFromTransactions(txns: TxnRow[]): DetectedSub[] {
  const byMerchant = new Map<string, TxnRow[]>();
  for (const t of txns) {
    if (t.amount <= 0) continue; // only money out
    const list = byMerchant.get(t.merchant) ?? [];
    list.push(t);
    byMerchant.set(t.merchant, list);
  }

  const detected: DetectedSub[] = [];
  for (const [merchant, rows] of byMerchant) {
    if (rows.length < 2) continue;
    rows.sort((a, b) => a.date.localeCompare(b.date));

    const gaps: number[] = [];
    for (let i = 1; i < rows.length; i++) {
      const ms = Date.parse(rows[i]!.date) - Date.parse(rows[i - 1]!.date);
      gaps.push(Math.round(ms / 86_400_000));
    }
    const cycle = classifyInterval(median(gaps));
    if (!cycle) continue;
    if (cycle === "weekly" && rows.length < 3) continue;

    // amount consistency: median-relative spread <= 15%
    const amounts = rows.map((r) => r.amount);
    const med = median(amounts);
    if (med <= 0) continue;
    const maxDev = Math.max(...amounts.map((a) => Math.abs(a - med) / med));
    if (maxDev > 0.15) continue;

    const lastSeen = rows[rows.length - 1]!.date;
    detected.push({
      vendor: merchant,
      category: rows[0]!.category || categorize(merchant),
      cost: Number(med.toFixed(2)),
      billingCycle: cycle,
      firstSeen: rows[0]!.date,
      lastSeen,
      nextBillingDate: addDays(lastSeen, CYCLE_DAYS[cycle]),
      occurrences: rows.length,
    });
  }
  return detected;
}

/** Run detection for a user and upsert Subscription docs. Returns fresh list. */
export async function runDetection(userId: string) {
  const txns = await findDocs<TxnRow>("Txn", ["date", "amount", "merchant", "category"], {
    filter: { userId: { _eq: userId } },
    limit: 5000,
  });
  const detected = detectFromTransactions(txns);

  const existing = await findDocs<any>(
    "Sub",
    ["vendor", "status", "detectedBy", "cost", "category", "billingCycle", "nextBillingDate", "lastSeen", "occurrences"],
    { filter: { userId: { _eq: userId } } }
  );
  const byVendor = new Map(existing.map((s: any) => [s.vendor, s]));

  for (const sub of detected) {
    const prior = byVendor.get(sub.vendor);
    if (prior) {
      const changed =
        prior.cost !== sub.cost ||
        prior.category !== sub.category ||
        prior.billingCycle !== sub.billingCycle ||
        prior.nextBillingDate !== sub.nextBillingDate ||
        prior.lastSeen !== sub.lastSeen ||
        prior.occurrences !== sub.occurrences;
      if (prior.status !== "cancelled" && changed) {
        await updateDoc("Sub", prior._docID, {
          cost: sub.cost,
          category: sub.category,
          billingCycle: sub.billingCycle,
          nextBillingDate: sub.nextBillingDate,
          lastSeen: sub.lastSeen,
          occurrences: sub.occurrences,
        });
      }
    } else {
      await createDoc("Sub", {
        userId,
        ...sub,
        status: "active",
        detectedBy: "transaction_match",
        createdAt: new Date().toISOString(),
      });
    }
  }

  const all = await findDocs<any>(
    "Sub",
    ["vendor", "category", "cost", "billingCycle", "nextBillingDate", "status", "detectedBy", "firstSeen", "lastSeen", "occurrences"],
    { filter: { userId: { _eq: userId } } }
  );

  // duplicate flags (computed, not stored): >1 active sub in a duplicate-prone category
  const activeByCategory = new Map<string, any[]>();
  for (const s of all) {
    if (s.status !== "active" || !DUPLICATE_PRONE.has(s.category)) continue;
    const list = activeByCategory.get(s.category) ?? [];
    list.push(s);
    activeByCategory.set(s.category, list);
  }
  const duplicateIds = new Set<string>();
  for (const list of activeByCategory.values()) {
    if (list.length > 1) list.forEach((s) => duplicateIds.add(s._docID));
  }

  return all.map((s: any) => ({ ...s, possibleDuplicate: duplicateIds.has(s._docID) }));
}

/** Monthly-equivalent cost of a subscription. */
export function monthlyCost(sub: { cost: number; billingCycle: string }): number {
  if (sub.billingCycle === "weekly") return (sub.cost * 52) / 12;
  if (sub.billingCycle === "yearly") return sub.cost / 12;
  return sub.cost;
}
