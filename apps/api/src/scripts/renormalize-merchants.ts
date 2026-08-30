/**
 * Re-applies merchant-name normalization to every stored transaction.
 *
 * Run after the normalizer changes (it strips transaction-type wording,
 * processor prefixes, corporate suffixes and per-transaction reference codes)
 * so existing rows collapse from one-merchant-per-transaction into real
 * merchants. Categories are recomputed at the same time.
 *
 *   npx tsx src/scripts/renormalize-merchants.ts          # apply
 *   npx tsx src/scripts/renormalize-merchants.ts --dry    # preview only
 */
import { findDocs, health, updateDoc } from "../lib/defra.js";
import { categorizeTxn, getCategoryAliases, getMerchantIndex, invalidateMerchantCache, normalizeMerchant } from "../services/categorizer.js";

const dryRun = process.argv.includes("--dry");

if (!(await health())) {
  console.error("DefraDB is not reachable. Start it first: npm run dev:defra");
  process.exit(1);
}

// 1. Clean the *names* of user-created merchant rules first. These were
//    captured from the old raw descriptor ("Atm Withdrawal -"), and because a
//    matching rule supplies the canonical name, a dirty rule name would be
//    stamped straight back onto every transaction below. Patterns are left
//    alone: they match against the untouched rawDescription.
const userMerchants = await findDocs<any>("Merchant", ["name", "pattern", "source"], {
  filter: { source: { _eq: "user" } },
  limit: 5000,
});
const ruleRenames = new Map<string, string>();
for (const m of userMerchants) {
  const cleaned = normalizeMerchant(m.name);
  if (cleaned && cleaned !== m.name) {
    console.log(`   rule: ${m.name}  ->  ${cleaned}`);
    ruleRenames.set(m.name, cleaned);
    if (!dryRun) await updateDoc("Merchant", m._docID, { name: cleaned });
  }
}
console.log(`${ruleRenames.size}/${userMerchants.length} merchant rules renamed${dryRun ? " (dry run)" : ""}\n`);
invalidateMerchantCache();

const users = await findDocs<any>("User", ["email"], { limit: 1000 });

for (const user of users) {
  // in a dry run the rule renames were not persisted — apply them in memory so
  // the preview reflects the post-run state (built-in names stay untouched)
  const index = (await getMerchantIndex(user._docID)).map((e) => ({
    ...e,
    name: ruleRenames.get(e.name) ?? e.name,
  }));
  const aliases = await getCategoryAliases(user._docID);
  const txns = await findDocs<any>("Txn", ["merchant", "rawDescription", "category", "flags"], {
    filter: { userId: { _eq: user._docID } },
    limit: 10000,
  });

  const before = new Set(txns.map((t: any) => t.merchant));
  const renames = new Map<string, string>();
  let changed = 0;

  for (const t of txns) {
    const source = t.rawDescription || t.merchant || "";
    const result = categorizeTxn(index, normalizeMerchant(source), source, undefined, aliases);
    const merchant = result.canonicalName ?? normalizeMerchant(source);

    const input: Record<string, unknown> = {};
    if (merchant && merchant !== t.merchant) {
      input.merchant = merchant;
      renames.set(t.merchant, merchant);
    }
    // respect per-transaction manual category exceptions
    const manual = Array.isArray(t.flags) && t.flags.includes("manual-category");
    if (!manual && result.category !== t.category && result.category !== "Other") {
      input.category = result.category;
    }
    if (Object.keys(input).length) {
      changed++;
      if (!dryRun) await updateDoc("Txn", t._docID, input);
    }
  }

  const after = new Set(txns.map((t: any) => renames.get(t.merchant) ?? t.merchant));
  console.log(
    `${user.email}: ${changed}/${txns.length} transactions updated · ` +
    `${before.size} distinct merchants -> ${after.size}${dryRun ? " (dry run)" : ""}`
  );
  for (const [from, to] of [...renames].slice(0, 15)) console.log(`   ${from}  ->  ${to}`);
  if (renames.size > 15) console.log(`   …and ${renames.size - 15} more`);
}

console.log(dryRun ? "\nDry run complete — no changes written." : "\nDone.");
