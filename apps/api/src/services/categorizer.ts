/**
 * Transaction categorization.
 *
 * Priority order (per product decision: the merchant list is the primary input):
 *   1. Merchant index — built-in catalog + the user's own merchants, persisted
 *      in the Defra `Merchant` collection. Longest matching pattern wins and
 *      also supplies a canonical merchant name.
 *   2. Regex rules (legacy fallback for descriptor shapes, e.g. "HYDRO").
 *   3. Plaid personal_finance_category hint, when the transaction came via Plaid.
 *   4. "Other".
 */
import { findDocs } from "../lib/defra.js";

export const CATEGORIES = [
  "Groceries",
  "Dining",
  "Streaming",
  "Software",
  "Fitness",
  "Telecom",
  "Utilities",
  "Transport",
  "Shopping",
  "Insurance",
  "Housing",
  "Income",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

// ---- Merchant index ---------------------------------------------------------

export interface MerchantIndexEntry {
  name: string;
  pattern: string;
  category: string;
}

const CACHE_TTL_MS = 60_000;
const indexCache = new Map<string, { at: number; entries: MerchantIndexEntry[] }>();

/** Per-user renames of builtin categories: original name → display name. */
export async function getCategoryAliases(userId?: string): Promise<Record<string, string>> {
  if (!userId) return {};
  const rows = await findDocs<any>("CategoryAlias", ["from", "to"], {
    filter: { userId: { _eq: userId } },
    limit: 100,
  });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.from] = r.to;
  return map;
}

/** Built-in merchants + this user's own, longest pattern first. Cached 60s. */
export async function getMerchantIndex(userId?: string): Promise<MerchantIndexEntry[]> {
  const key = userId ?? "";
  const hit = indexCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.entries;

  const filter = userId
    ? { _or: [{ userId: { _eq: "" } }, { userId: { _eq: userId } }] }
    : { userId: { _eq: "" } };
  const rows = await findDocs<any>("Merchant", ["name", "pattern", "category", "userId"], {
    filter,
    limit: 5000,
  });
  // apply the user's builtin-category renames so index results carry display names
  const aliases = await getCategoryAliases(userId);
  for (const r of rows) r.category = aliases[r.category] ?? r.category;
  // a merchant's pattern field holds one or more comma-separated match texts —
  // expand to one index entry per pattern; user-added merchants outrank
  // builtins at equal pattern length
  const entries: MerchantIndexEntry[] = rows
    .flatMap((r: any) =>
      String(r.pattern)
        .split(",")
        .map((p: string) => p.trim().toLowerCase())
        .filter((p: string) => p.length >= 2)
        .map((p: string) => ({ name: r.name, pattern: p, category: r.category, _user: Boolean(r.userId) }))
    )
    .sort((a, b) => b.pattern.length - a.pattern.length || Number(b._user) - Number(a._user))
    .map(({ name, pattern, category }) => ({ name, pattern, category }));
  indexCache.set(key, { at: Date.now(), entries });
  return entries;
}

export function invalidateMerchantCache() {
  indexCache.clear();
}

export interface CategorizeResult {
  category: Category | string;
  /** canonical merchant name when a catalog entry matched */
  canonicalName?: string;
}

export function categorizeTxn(
  index: MerchantIndexEntry[],
  merchant: string,
  rawDescription = "",
  plaidHint?: string,
  aliases: Record<string, string> = {}
): CategorizeResult {
  const text = `${merchant} ${rawDescription}`.toLowerCase();
  for (const entry of index) {
    if (text.includes(entry.pattern)) {
      // index categories are already alias-mapped in getMerchantIndex
      return { category: entry.category, canonicalName: entry.name };
    }
  }
  const byRule = regexCategory(merchant, rawDescription);
  if (byRule !== "Other") return { category: aliases[byRule] ?? byRule };
  if (plaidHint) {
    const mapped = PLAID_PFC_MAP[plaidHint];
    if (mapped) return { category: aliases[mapped] ?? mapped };
  }
  return { category: aliases["Other"] ?? "Other" };
}

// ---- Plaid personal_finance_category.primary → our categories ---------------

const PLAID_PFC_MAP: Record<string, Category> = {
  FOOD_AND_DRINK: "Dining",
  GENERAL_MERCHANDISE: "Shopping",
  TRANSPORTATION: "Transport",
  TRAVEL: "Transport",
  RENT_AND_UTILITIES: "Utilities",
  ENTERTAINMENT: "Streaming",
  PERSONAL_CARE: "Shopping",
  INCOME: "Income",
  TRANSFER_IN: "Income",
  MEDICAL: "Other",
  LOAN_PAYMENTS: "Housing",
  HOME_IMPROVEMENT: "Housing",
};

// ---- Legacy regex rules (fallback tier) --------------------------------------

const RULES: Array<[Category, RegExp]> = [
  ["Groceries", /grocery|supermarket|food mart/i],
  ["Dining", /restaurant|cafe|coffee|bistro|diner|bakery|pub\b|bar & grill/i],
  ["Streaming", /streaming|\.tv\b/i],
  ["Software", /software|saas|hosting|domain/i],
  ["Fitness", /fitness|gym\b|yoga|pilates|crossfit|climbing/i],
  ["Telecom", /wireless|mobile bill|internet bill|telecom/i],
  ["Utilities", /hydro|electric bill|utility|water bill|gas bill|energy/i],
  ["Transport", /transit|parking|fuel|gas station|taxi|rail|airline|airways/i],
  ["Insurance", /insurance|assurance/i],
  ["Housing", /rent\b|mortgage|landlord|property mgmt|condo/i],
  ["Income", /payroll|salary|direct deposit|refund|reimbursement/i],
  ["Shopping", /store\b|shop\b|market\b|boutique/i],
];

function regexCategory(merchant: string, rawDescription = ""): Category {
  const text = `${merchant} ${rawDescription}`;
  for (const [category, pattern] of RULES) {
    if (pattern.test(text)) return category;
  }
  return "Other";
}

/** Legacy sync API (no merchant index) — used only where async lookup is impractical. */
export function categorize(merchant: string, rawDescription = ""): Category {
  return regexCategory(merchant, rawDescription);
}

/** Normalize a raw bank descriptor into a stable merchant key. */
export function normalizeMerchant(raw: string): string {
  return raw
    .replace(/\*|,|#\d+|\bx{2,}\d*\b/gi, " ") // commas stripped: they separate match patterns
    .replace(/\b\d{3,}\b/g, " ")     // store numbers, phone fragments
    .replace(/\s{2,}/g, " ")
    .trim()
    .toUpperCase();
}
