/**
 * Category service: built-in categories (fixed, colored in the UI) plus
 * per-user custom categories stored in the Defra `Category` collection.
 */
import { findDocs } from "../lib/defra.js";
import { CATEGORIES, getCategoryAliases } from "./categorizer.js";

export const BUILTIN_CATEGORIES: readonly string[] = CATEGORIES;

/** Default palette slots for builtin categories (mirrors the web slot map),
 *  used to carry a builtin's color along when it is renamed. */
export const DEFAULT_SLOTS: Record<string, number> = {
  Groceries: 1, Dining: 2, Streaming: 3, Telecom: 4,
  Transport: 5, Fitness: 6, Software: 7, Shopping: 8,
};

/** Builtin categories as this user sees them: renamed via alias, hidden ones
 *  (alias to "") removed. "Other" is never renamed or hidden. */
export async function getDisplayBuiltins(userId: string): Promise<string[]> {
  const aliases = await getCategoryAliases(userId);
  return BUILTIN_CATEGORIES
    .map((b) => aliases[b] ?? b)
    .filter((n) => n !== "");
}

export async function getCustomCategories(userId: string): Promise<Array<{ _docID: string; name: string }>> {
  const rows = await findDocs<any>("Category", ["name"], {
    filter: { userId: { _eq: userId } },
    limit: 500,
  });
  return rows.sort((a: any, b: any) => a.name.localeCompare(b.name));
}

/** All category names this user may assign (display builtins + their custom ones). */
export async function getAllowedCategories(userId: string): Promise<string[]> {
  const [builtins, custom] = await Promise.all([getDisplayBuiltins(userId), getCustomCategories(userId)]);
  return [...builtins, ...custom.map((c) => c.name)];
}

export async function assertAllowedCategory(userId: string, category: string): Promise<void> {
  const allowed = await getAllowedCategories(userId);
  if (!allowed.includes(category)) {
    const err = new Error(`Unknown category "${category}" — create it first via POST /categories`);
    (err as any).status = 400;
    throw err;
  }
}
