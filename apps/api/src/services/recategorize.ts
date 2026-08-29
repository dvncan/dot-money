/**
 * Re-applies merchant-index categorization to a user's stored transactions.
 * Used after the merchant catalog changes (user adds a merchant, catalog
 * update) and exposed via POST /transactions/recategorize.
 * Only the category is rewritten — merchant strings and raw descriptions stay.
 */
import { findDocs, updateDoc } from "../lib/defra.js";
import { categorizeTxn, getCategoryAliases, getMerchantIndex } from "./categorizer.js";

export async function recategorizeUser(userId: string): Promise<{ total: number; updated: number }> {
  const index = await getMerchantIndex(userId);
  const aliases = await getCategoryAliases(userId);
  const txns = await findDocs<any>("Txn", ["merchant", "rawDescription", "category", "flags"], {
    filter: { userId: { _eq: userId } },
    limit: 10000,
  });
  let updated = 0;
  for (const t of txns) {
    // never overwrite a per-transaction manual exception
    if (Array.isArray(t.flags) && t.flags.includes("manual-category")) continue;
    const { category } = categorizeTxn(index, t.merchant ?? "", t.rawDescription ?? "", undefined, aliases);
    if (category !== t.category && category !== "Other") {
      await updateDoc("Txn", t._docID, { category });
      updated++;
    }
  }
  return { total: txns.length, updated };
}
