/**
 * CSV import fallback for banks not covered by Plaid.
 * Expected columns (header row, flexible order/case): date, description, amount
 * Optional: merchant, category. Amount convention: positive = money out.
 * Rows with amount in a "debit"/"credit" column pair are also handled.
 */
import { createDoc, findDocs } from "../lib/defra.js";
import { categorizeTxn, getCategoryAliases, getMerchantIndex, normalizeMerchant } from "./categorizer.js";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((f) => f.trim() !== "")) rows.push(row); }
  return rows;
}

function toIsoDate(raw: string): string | null {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const mdY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // MM/DD/YYYY
  if (mdY) return `${mdY[3]}-${mdY[1]!.padStart(2, "0")}-${mdY[2]!.padStart(2, "0")}`;
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

export async function importCsv(userId: string, csvText: string, accountLabel = "CSV import") {
  const rows = parseCsv(csvText);
  if (rows.length < 2) return { imported: 0, skipped: 0, errors: ["CSV has no data rows"] };

  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const iDate = col("date", "transaction date", "posted date");
  const iDesc = col("description", "details", "name", "payee", "description 1");
  const iDesc2 = col("description 2");
  const iAmount = col("amount", "value");
  const iDebit = col("debit", "withdrawal", "withdrawals");
  const iCredit = col("credit", "deposit", "deposits");
  // RBC exports use a "CAD$" column where NEGATIVE means money out — the
  // opposite of our convention, so RBC amounts get sign-flipped below.
  const iCad = col("cad$");
  const iMerchant = col("merchant");
  const iCategory = col("category");
  if (iDate < 0 || iDesc < 0 || (iAmount < 0 && iDebit < 0 && iCad < 0)) {
    return { imported: 0, skipped: 0, errors: ["CSV must have date, description, and amount (or debit/credit, or RBC CAD$) columns"] };
  }

  const accountId = await createDoc("BankAccount", {
    userId, institution: accountLabel, accountName: accountLabel, accountType: "imported",
    mask: "", plaidItemId: "", plaidAccessToken: "", source: "csv",
    createdAt: new Date().toISOString(),
  });

  const seen = new Set(
    (await findDocs<any>("Txn", ["rawDescription", "date", "amount"], {
      filter: { userId: { _eq: userId } }, limit: 10000,
    })).map((t: any) => `${t.date}|${t.amount}|${t.rawDescription}`)
  );

  let imported = 0, skipped = 0;
  const errors: string[] = [];
  const merchantIndex = await getMerchantIndex(userId);
  const aliases = await getCategoryAliases(userId);
  for (const row of rows.slice(1)) {
    const date = toIsoDate(row[iDate] ?? "");
    if (!date) { skipped++; continue; }
    let amount: number;
    if (iAmount >= 0 && row[iAmount]?.trim()) {
      amount = Number(row[iAmount]!.replace(/[$,]/g, ""));
    } else if (iCad >= 0 && row[iCad]?.trim()) {
      amount = -Number(row[iCad]!.replace(/[$,]/g, "")); // RBC: negative = outflow → flip
    } else {
      const debit = Number((iDebit >= 0 ? row[iDebit] ?? "" : "").replace(/[$,]/g, "") || 0);
      const credit = Number((iCredit >= 0 ? row[iCredit] ?? "" : "").replace(/[$,]/g, "") || 0);
      amount = debit > 0 ? debit : -credit;
    }
    if (!isFinite(amount) || amount === 0) { skipped++; continue; }
    const rawDescription = [(row[iDesc] ?? "").trim(), iDesc2 >= 0 ? (row[iDesc2] ?? "").trim() : ""]
      .filter(Boolean)
      .join(" ");
    const key = `${date}|${amount}|${rawDescription}`;
    if (seen.has(key)) { skipped++; continue; }
    seen.add(key);
    const normalized = iMerchant >= 0 && row[iMerchant]?.trim()
      ? normalizeMerchant(row[iMerchant]!)
      : normalizeMerchant(rawDescription);
    const result = categorizeTxn(merchantIndex, normalized, rawDescription, undefined, aliases);
    await createDoc("Txn", {
      userId, bankAccountId: accountId, date, amount,
      merchant: result.canonicalName ? normalizeMerchant(result.canonicalName) : normalized,
      rawDescription,
      category: iCategory >= 0 && row[iCategory]?.trim() ? row[iCategory]!.trim() : result.category,
      subscriptionId: "", flags: [], source: "csv",
    });
    imported++;
  }
  return { imported, skipped, errors };
}
