/**
 * Bootstraps the local DefraDB node, idempotently:
 *   1. Adds any schema types that don't exist yet (additive — safe to re-run
 *      after new collections are added to schema.graphql).
 *   2. Seeds the built-in merchant catalog if the Merchant collection is empty.
 *   3. Re-categorizes every user's transactions when the catalog was (re)seeded.
 *
 *   npm run bootstrap   (from repo root or apps/api)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { addSchema, createDoc, findDocs, health, listCollections } from "../lib/defra.js";
import { MERCHANT_CATALOG } from "../services/merchantCatalog.js";
import { recategorizeUser } from "../services/recategorize.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const sdl = readFileSync(path.resolve(here, "../defra/schema.graphql"), "utf8");

if (!(await health())) {
  console.error("DefraDB is not reachable. Start it first: npm run dev:defra");
  process.exit(1);
}

// ---- 1. Add missing schema types -------------------------------------------
const existing = new Set(await listCollections());
const blocks = [...sdl.matchAll(/type\s+(\w+)\s*\{[\s\S]*?\n\}/g)];
const missing = blocks.filter((m) => !existing.has(m[1]!));

if (missing.length) {
  const result = await addSchema(missing.map((m) => m[0]).join("\n\n"));
  if (!result.ok) {
    console.error("Schema add failed:", result.detail);
    process.exit(1);
  }
  console.log(`Added collections: ${missing.map((m) => m[1]).join(", ")}`);
} else {
  console.log("Schema up to date.");
}

// ---- 2. Seed the built-in merchant catalog ----------------------------------
const builtins = await findDocs<any>("Merchant", ["name"], {
  filter: { source: { _eq: "builtin" } },
  limit: 1,
});
let catalogSeeded = false;
if (!builtins.length) {
  let added = 0;
  for (const entry of MERCHANT_CATALOG) {
    await createDoc("Merchant", {
      name: entry.name,
      pattern: entry.pattern,
      category: entry.category,
      address: "",
      city: "",
      province: "",
      country: entry.country,
      source: "builtin",
      userId: "",
      createdAt: new Date().toISOString(),
    });
    added++;
  }
  console.log(`Seeded ${added} built-in merchants.`);
  catalogSeeded = true;
} else {
  console.log("Merchant catalog already seeded.");
}

// ---- 3. Re-categorize existing transactions after a fresh catalog -----------
if (catalogSeeded) {
  const users = await findDocs<any>("User", ["email"], { limit: 1000 });
  for (const u of users) {
    const { total, updated } = await recategorizeUser(u._docID);
    if (total) console.log(`Re-categorized ${u.email}: ${updated}/${total} transactions updated.`);
  }
}

console.log("Bootstrap complete. Collections:", (await listCollections()).join(", "));
