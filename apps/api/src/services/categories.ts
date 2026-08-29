/**
 * Category service: built-in categories (fixed, colored in the UI) plus
 * per-user custom categories stored in the Defra `Category` collection.
 */
import { findDocs } from "../lib/defra.js";
import { CATEGORIES } from "./categorizer.js";

export const BUILTIN_CATEGORIES: readonly string[] = CATEGORIES;

export async function getCustomCategories(userId: string): Promise<Array<{ _docID: string; name: string }>> {
  const rows = await findDocs<any>("Category", ["name"], {
    filter: { userId: { _eq: userId } },
    limit: 500,
  });
  return rows.sort((a: any, b: any) => a.name.localeCompare(b.name));
}

/** All category names this user may assign (builtin + their custom ones). */
export async function getAllowedCategories(userId: string): Promise<string[]> {
  const custom = await getCustomCategories(userId);
  return [...BUILTIN_CATEGORIES, ...custom.map((c) => c.name)];
}

export async function assertAllowedCategory(userId: string, category: string): Promise<void> {
  const allowed = await getAllowedCategories(userId);
  if (!allowed.includes(category)) {
    const err = new Error(`Unknown category "${category}" — create it first via POST /categories`);
    (err as any).status = 400;
    throw err;
  }
}
