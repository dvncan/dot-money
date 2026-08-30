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

// ---- Merchant name normalization --------------------------------------------
//
// Bank descriptors bury the merchant inside transaction-type wording, payment
// processor prefixes, corporate suffixes and a per-transaction reference code:
//
//   "E-Transfer Request Fulfilled Paybilt Inc. Km8f9u"  ->  "Paybilt"
//   "POS PURCHASE 1234 TIM HORTONS #2291 TORONTO ON"    ->  "Tim Hortons Toronto"
//   "SQ *BLUE DOOR COFFEE"                              ->  "Blue Door Coffee"
//
// Reference codes are the important one: they differ on every transaction, so
// without stripping them each payment looks like a brand new merchant and the
// merchant list explodes into unique one-off rows.

/** Transaction-type wording banks prepend/append around the real merchant. */
const NOISE_PHRASES = [
  // Interac / e-transfers
  "e-transfer request fulfilled", "e-transfer request received", "e-transfer request sent",
  "e-transfer received", "e-transfer sent", "e-transfer cancelled", "interac e-transfer",
  // inbound e-transfer wording — stripping it merges the money-in side with the
  // money-out side of the same merchant, so a net can be shown
  "e-transfer - autodeposit", "e-transfer autodeposit", "autodeposit",
  "interac etransfer", "email money transfer", "e-transfer", "etransfer", "interac purchase",
  "interac retail purchase", "interac",
  // card / point of sale
  "contactless interac purchase", "contactless interac", "contactless retail purchase",
  "point of sale purchase", "point of sale - interac", "point of sale", "pos purchase",
  "visa debit retail purchase", "visa debit purchase", "visa debit", "debit purchase",
  "contactless purchase", "retail purchase", "purchase authorized on", "card purchase",
  "purchase from", "payment to",
  // banking operations
  "online banking transfer", "online banking payment", "online banking loan payment",
  "online banking", "online transfer", "internet banking", "mobile banking",
  "pre-authorized debit", "preauthorized debit", "pre-auth debit", "pre-authorized payment",
  "recurring payment", "monthly plan fee", "bill payment", "misc payment",
  "electronic funds transfer", "funds transfer", "ach electronic credit",
  "ach electronic debit", "direct debit", "wire transfer",
];

/** Payment-processor prefixes glued onto the front of the merchant. */
const PROCESSOR_PREFIXES = [
  "sq *", "sq*", "tst*", "tst *", "pp*", "pp *", "paypal *", "paypal*",
  "sp *", "sp*", "wl *", "wl*", "wpy*", "dd *", "dd*", "amzn mktp",
];

/** Legal-entity suffixes, stripped from the tail. */
const CORPORATE_SUFFIXES = new Set([
  "inc", "incorporated", "ltd", "ltda", "limited", "ltee", "ltée", "llc", "llp", "lp",
  "corp", "corporation", "ulc", "plc", "gmbh", "sarl", "nv", "bv", "pty", "co",
]);

const PROVINCE_CODES = new Set([
  "on", "bc", "ab", "qc", "mb", "sk", "ns", "nb", "nl", "pe", "yt", "nt", "nu",
]);

/** Short all-caps tokens that should stay upper-case when title casing. */
const ACRONYMS = new Set([
  "iga", "lcbo", "saq", "ttc", "stm", "kfc", "ihop", "mec", "bmo", "rbc", "td",
  "cibc", "hbc", "cra", "gst", "hst", "ymca", "ups", "usps", "att", "hbo", "bbq",
  "nhl", "nba", "nfl", "mlb", "tsn", "cbc", "ctv", "amc", "ach", "atm", "lcbo",
]);

/**
 * A token that carries no meaning across transactions — a confirmation number,
 * auth code or reference id. Mixed letters+digits ("Km8f9u", "P22F1A44B2") or a
 * long digit run. Deliberately conservative: applied only to trailing tokens,
 * so names that legitimately mix digits ("F45 Training", "7-Eleven") survive.
 */
function isReferenceCode(token: string): boolean {
  const t = token.replace(/[^A-Za-z0-9]/g, "");
  if (t.length < 3) return false;
  const digits = (t.match(/\d/g) ?? []).length;
  const letters = (t.match(/[A-Za-z]/g) ?? []).length;
  if (digits === 0) return false;
  if (letters === 0) return t.length >= 3;        // 4521, 000123
  return digits >= 2 && t.length >= 4;            // Km8f9u, P22F1A44B2, A1B2C3
}

function titleCasePart(part: string): string {
  const bare = part.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
  if (!bare) return part;
  if (ACRONYMS.has(bare)) return part.toUpperCase();
  // capitalize after non-alphanumerics only, so ordinals stay lowercase (14th, 3rd)
  const cased = part
    .toLowerCase()
    .replace(/(^|[^A-Za-z0-9'])([a-z])/g, (_m, pre: string, ch: string) => pre + ch.toUpperCase());
  // McDonald / MacMillan
  return cased.replace(/\bMc([a-z])/g, (_m, ch: string) => "Mc" + ch.toUpperCase());
}

/** Title-case a token, casing each separator-delimited part (LCBO/RAO, 7-Eleven). */
function titleCaseToken(token: string): string {
  const withoutTld = token.replace(/\.(com|ca|net|org|io|co|shop|store)$/i, "");
  const source = withoutTld.length >= 2 ? withoutTld : token;
  return source.replace(/[^/\-.]+/g, (part) => titleCasePart(part));
}

/**
 * Normalize a raw bank descriptor into a stable, human-readable merchant name.
 * Never returns an empty string — if stripping would remove everything, the
 * lightly-cleaned descriptor is kept instead.
 */
export function normalizeMerchant(raw: string): string {
  // 1. light cleanup: separators, store numbers, masked card digits
  //    (commas go early — they separate match patterns elsewhere)
  const base = raw
    .replace(/[,]/g, " ")
    .replace(/#\s?\d+/g, " ")
    .replace(/\bx{2,}\d*\b/gi, " ")
    // FX conversion tails: "36.84 USD @ 1.3521", "@ $ 5.00", "20.99%"
    .replace(/\b[\d.]+\s*(usd|cad|eur|gbp|aud)\b\s*@?\s*[\d.]*/gi, " ")
    .replace(/@\s*\$?\s*[\d.]+/g, " ")
    .replace(/\b\d+(\.\d+)?%/g, " ")
    .replace(/\.(com|ca|net|org|io|shop|store)\b/gi, " ") // netflix.com -> netflix
    .replace(/\s{2,}/g, " ")
    .trim();

  let working = base.toLowerCase();

  // 2. processor prefixes ("SQ *Blue Door" -> "blue door")
  for (const prefix of PROCESSOR_PREFIXES) {
    if (working.startsWith(prefix)) {
      working = working.slice(prefix.length).trim();
      break;
    }
  }
  working = working.replace(/\*/g, " ");

  // 3. transaction-type wording, longest phrase first so "e-transfer request
  //    fulfilled" wins over "e-transfer"
  for (const phrase of [...NOISE_PHRASES].sort((a, b) => b.length - a.length)) {
    working = working.replace(new RegExp(`(^|\\s)${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`, "g"), " ");
  }
  working = working.replace(/\s{2,}/g, " ").trim();

  // 4. long digit runs anywhere (dates, store ids, phone fragments)
  working = working.replace(/\b\d{3,}\b/g, " ").replace(/\s{2,}/g, " ").trim();

  // 5. trim junk from both ends: reference codes, corporate suffixes, province
  //    codes, and punctuation left behind by the stripped wording
  const trim = (input: string): string => {
    let tokens = input.split(" ").filter(Boolean);

    // Anything after a legal-entity suffix is a reference code, whatever it
    // looks like: "paybilt inc. wewqpj" and "paybilt inc. km8f9u" are the same
    // merchant. Matching on the suffix avoids having to guess whether a random
    // trailing word ("Wewqpj") is a code or part of the name.
    const suffixAt = tokens.findIndex((tok) =>
      CORPORATE_SUFFIXES.has(tok.replace(/[^A-Za-z0-9]/g, "").toLowerCase())
    );
    if (suffixAt > 0 && suffixAt < tokens.length - 1) tokens = tokens.slice(0, suffixAt + 1);
    const isJunkTail = (tok: string) => {
      const bare = tok.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
      return isReferenceCode(tok) || CORPORATE_SUFFIXES.has(bare) || PROVINCE_CODES.has(bare);
    };
    const isPunctuation = (tok: string) => !/[A-Za-z0-9]/.test(tok);
    let changed = true;
    while (changed && tokens.length > 0) {
      changed = false;
      const last = tokens[tokens.length - 1]!;
      if (isJunkTail(last) || isPunctuation(last)) {
        tokens.pop();
        changed = true;
      }
      if (tokens.length && isPunctuation(tokens[0]!)) {
        tokens.shift();
        changed = true;
      }
    }
    // dangling connector left by removed wording ("online transfer to deposit")
    while (tokens.length > 1 && /^(to|from|for|at|on|of)$/i.test(tokens[0]!)) tokens.shift();
    // collapse an immediately repeated token ("moneygram moneygram.com")
    tokens = tokens.filter((tok, i) => {
      const prev = tokens[i - 1];
      return !prev || prev.replace(/[^a-z0-9]/gi, "") !== tok.replace(/[^a-z0-9]/gi, "");
    });
    return tokens.join(" ").replace(/^[\s\-–—:|/*]+|[\s\-–—:|/*]+$/g, "").trim();
  };

  const cleaned = trim(working);

  // 6. never return nothing: if the wording *was* the whole descriptor (e.g.
  //    "ONLINE BANKING TRANSFER - 8461"), keep the wording as a stable bucket
  //    name rather than the raw text — otherwise the trailing reference number
  //    would make every one of them a separate merchant.
  const fallback = trim(base.toLowerCase().replace(/\b\d{3,}\b/g, " ").replace(/\s{2,}/g, " ").trim());
  const source = cleaned.length >= 2 ? cleaned : fallback.length >= 2 ? fallback : base;
  return source.split(/\s+/).filter(Boolean).map(titleCaseToken).join(" ");
}
