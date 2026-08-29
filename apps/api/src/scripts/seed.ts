/**
 * Seeds a demo user with ~5 months of realistic Canadian transactions so the
 * app is fully explorable without Plaid keys.
 *
 *   Login: demo@finshield.ca / demo-password-123
 */
import bcrypt from "bcryptjs";
import { createDoc, findDocs, health } from "../lib/defra.js";
import { categorizeTxn, getMerchantIndex, normalizeMerchant } from "../services/categorizer.js";
import { runDetection } from "../services/subscriptionDetector.js";

if (!(await health())) {
  console.error("DefraDB is not reachable. Start it (npm run dev:defra) and bootstrap the schema first.");
  process.exit(1);
}

const EMAIL = "demo@finshield.ca";
const existing = await findDocs<any>("User", ["email"], { filter: { email: { _eq: EMAIL } }, limit: 1 });
if (existing[0]) {
  console.log("Demo user already seeded. Login: demo@finshield.ca / demo-password-123");
  process.exit(0);
}

const userId = await createDoc("User", {
  email: EMAIL,
  passwordHash: await bcrypt.hash("demo-password-123", 10),
  name: "Demo User",
  province: "ON",
  createdAt: new Date().toISOString(),
});

const accountId = await createDoc("BankAccount", {
  userId, institution: "RBC Royal Bank (demo)", accountName: "Chequing", accountType: "chequing",
  mask: "4521", plaidItemId: "", plaidAccessToken: "", source: "csv",
  createdAt: new Date().toISOString(),
});

function iso(d: Date): string { return d.toISOString().slice(0, 10); }
function monthsAgo(m: number, day: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - m);
  d.setDate(Math.min(day, 28));
  return d;
}

type SeedTxn = { date: string; amount: number; desc: string };
const txns: SeedTxn[] = [];

// --- Recurring subscriptions (5 months back) --------------------------------
const subs: Array<{ desc: string; amount: number; day: number }> = [
  { desc: "NETFLIX.COM 866-716-0414", amount: 20.99, day: 3 },
  { desc: "Spotify P22F1A44B2", amount: 11.99, day: 7 },
  { desc: "CRAVE ENTERTAINMENT", amount: 22.99, day: 12 },  // duplicate streaming vs Netflix
  { desc: "DISNEY PLUS", amount: 12.99, day: 15 },          // triple streaming!
  { desc: "GOODLIFE FITNESS CLUBS", amount: 47.13, day: 1 },
  { desc: "APPLE.COM/BILL ON", amount: 3.99, day: 20 },
  { desc: "ROGERS COMMUNICATIONS", amount: 95.48, day: 22 },
  { desc: "BELL CANADA INTERNET", amount: 84.75, day: 25 },
];
for (let m = 5; m >= 0; m--) {
  for (const s of subs) {
    const d = monthsAgo(m, s.day);
    if (d > new Date()) continue;
    txns.push({ date: iso(d), amount: s.amount, desc: s.desc });
  }
}

// --- Everyday spending -------------------------------------------------------
const everyday: Array<{ desc: string; min: number; max: number; perMonth: number }> = [
  { desc: "LOBLAWS #1034 TORONTO", min: 45, max: 160, perMonth: 5 },
  { desc: "TIM HORTONS #2291", min: 3, max: 14, perMonth: 8 },
  { desc: "UBER EATS TORONTO", min: 22, max: 58, perMonth: 3 },
  { desc: "PRESTO FARE TORONTO", min: 3.35, max: 3.35, perMonth: 12 },
  { desc: "SHOPPERS DRUG MART #0842", min: 8, max: 65, perMonth: 2 },
  { desc: "AMAZON.CA PURCHASE", min: 15, max: 120, perMonth: 3 },
  { desc: "PETRO-CANADA 7712", min: 40, max: 75, perMonth: 2 },
  { desc: "LCBO/RAO #0517", min: 18, max: 55, perMonth: 2 },
];
let rngState = 42;
function rng(): number { // deterministic seed data
  rngState = (rngState * 1103515245 + 12345) % 2147483648;
  return rngState / 2147483648;
}
for (let m = 5; m >= 0; m--) {
  for (const e of everyday) {
    for (let i = 0; i < e.perMonth; i++) {
      const d = monthsAgo(m, 1 + Math.floor(rng() * 27));
      if (d > new Date()) continue;
      const amount = Number((e.min + rng() * (e.max - e.min)).toFixed(2));
      txns.push({ date: iso(d), amount, desc: e.desc });
    }
  }
}

// One anomaly: a big unusual charge at a usually-small merchant
txns.push({ date: iso(monthsAgo(0, 9)), amount: 189.99, desc: "AMAZON.CA PURCHASE" });

// Income (money in = negative amount by our convention)
for (let m = 5; m >= 0; m--) {
  for (const day of [1, 15]) {
    const d = monthsAgo(m, day);
    if (d > new Date()) continue;
    txns.push({ date: iso(d), amount: -2680.0, desc: "PAYROLL DIRECT DEPOSIT ACME CORP" });
  }
}

// DefraDB docIDs are content-derived: identical docs collide. Nudge exact
// duplicates (e.g. two identical transit fares on one day) to the next day.
const used = new Set<string>();
for (const t of txns) {
  let key = `${t.date}|${t.amount}|${t.desc}`;
  while (used.has(key)) {
    const d = new Date(`${t.date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    t.date = d.toISOString().slice(0, 10);
    key = `${t.date}|${t.amount}|${t.desc}`;
  }
  used.add(key);
}

let count = 0;
const merchantIndex = await getMerchantIndex(userId);
for (const t of txns) {
  const merchant = normalizeMerchant(t.desc);
  const result = categorizeTxn(merchantIndex, merchant, t.desc);
  await createDoc("Txn", {
    userId, bankAccountId: accountId, date: t.date, amount: t.amount,
    merchant, rawDescription: t.desc, category: result.category,
    subscriptionId: "", flags: [], source: "seed",
  });
  count++;
}

await runDetection(userId);

// A couple of starter budgets
await createDoc("Budget", { userId, category: "Groceries", limit: 600, period: "monthly", createdAt: new Date().toISOString() });
await createDoc("Budget", { userId, category: "Dining", limit: 250, period: "monthly", createdAt: new Date().toISOString() });
await createDoc("Budget", { userId, category: "Streaming", limit: 40, period: "monthly", createdAt: new Date().toISOString() });

console.log(`Seeded ${count} transactions for demo user.`);
console.log("Login: demo@finshield.ca / demo-password-123");
