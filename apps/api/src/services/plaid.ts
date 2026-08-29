/**
 * Plaid integration (sandbox-first), scoped to Canadian institutions.
 * When PLAID_CLIENT_ID/SECRET are unset the routes return 503 with guidance,
 * and the CSV import path remains fully functional.
 */
import { Configuration, CountryCode, PlaidApi, PlaidEnvironments, Products } from "plaid";
import { config } from "../config.js";
import { createDoc, findDocs, updateDoc } from "../lib/defra.js";
import { categorizeTxn, getCategoryAliases, getMerchantIndex, normalizeMerchant } from "./categorizer.js";

let client: PlaidApi | null = null;

export function plaidEnabled(): boolean {
  return config.plaid.enabled;
}

function getClient(): PlaidApi {
  if (!client) {
    client = new PlaidApi(
      new Configuration({
        basePath: PlaidEnvironments[config.plaid.env],
        baseOptions: {
          headers: {
            "PLAID-CLIENT-ID": config.plaid.clientId,
            "PLAID-SECRET": config.plaid.secret,
          },
        },
      })
    );
  }
  return client;
}

export async function createLinkToken(userId: string): Promise<string> {
  const res = await getClient().linkTokenCreate({
    user: { client_user_id: userId },
    client_name: "DotMoney",
    products: [Products.Transactions],
    country_codes: [CountryCode.Ca],
    language: "en",
  });
  return res.data.link_token;
}

export async function exchangeAndStore(userId: string, publicToken: string) {
  const plaid = getClient();
  const exchange = await plaid.itemPublicTokenExchange({ public_token: publicToken });
  const accessToken = exchange.data.access_token;
  const itemId = exchange.data.item_id;

  const accounts = await plaid.accountsGet({ access_token: accessToken });
  const created: string[] = [];
  for (const acct of accounts.data.accounts) {
    const docID = await createDoc("BankAccount", {
      userId,
      institution: (accounts.data.item as { institution_name?: string }).institution_name ?? accounts.data.item.institution_id ?? "Unknown",
      accountName: acct.name,
      accountType: acct.subtype ?? acct.type,
      mask: acct.mask ?? "",
      plaidItemId: itemId,
      plaidAccessToken: accessToken, // MVP: plaintext in local node. TODO: envelope-encrypt before hosted deployment.
      source: "plaid",
      createdAt: new Date().toISOString(),
    });
    created.push(docID);
  }
  return created;
}

/** Pull recent transactions for all of a user's Plaid-linked accounts. */
export async function syncTransactions(userId: string): Promise<number> {
  const accounts = await findDocs<any>(
    "BankAccount",
    ["plaidAccessToken", "plaidItemId", "source"],
    { filter: { userId: { _eq: userId }, source: { _eq: "plaid" } } }
  );
  const plaid = getClient();
  let imported = 0;

  const seen = new Set(
    (await findDocs<any>("Txn", ["rawDescription", "date", "amount"], {
      filter: { userId: { _eq: userId } },
      limit: 10000,
    })).map((t: any) => `${t.date}|${t.amount}|${t.rawDescription}`)
  );

  const merchantIndex = await getMerchantIndex(userId);
  const aliases = await getCategoryAliases(userId);
  const uniqueTokens = [...new Set(accounts.map((a: any) => a.plaidAccessToken).filter(Boolean))];
  for (const token of uniqueTokens) {
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10);
    const res = await plaid.transactionsGet({
      access_token: token as string,
      start_date: start,
      end_date: end,
      options: { count: 500 },
    });
    for (const t of res.data.transactions) {
      const key = `${t.date}|${t.amount}|${t.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const normalized = normalizeMerchant(t.merchant_name ?? t.name);
      const result = categorizeTxn(
        merchantIndex,
        normalized,
        t.name,
        (t as any).personal_finance_category?.primary,
        aliases
      );
      await createDoc("Txn", {
        userId,
        bankAccountId: t.account_id,
        date: t.date,
        amount: t.amount, // Plaid: positive = outflow, matching our convention
        merchant: result.canonicalName ? normalizeMerchant(result.canonicalName) : normalized,
        rawDescription: t.name,
        category: result.category,
        subscriptionId: "",
        flags: [],
        source: "plaid",
      });
      imported++;
    }
  }
  return imported;
}
