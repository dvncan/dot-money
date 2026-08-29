/**
 * Category → categorical slot mapping.
 * Fixed assignment (color follows the entity, never its rank): a category keeps
 * its slot no matter how the data is filtered or sorted. Slots beyond 8 fold to
 * a muted "Other" gray.
 */
const SLOT_BY_CATEGORY: Record<string, number> = {
  Groceries: 1,
  Dining: 2,
  Streaming: 3,
  Telecom: 4,
  Transport: 5,
  Fitness: 6,
  Software: 7,
  Shopping: 8,
};

export function categoryColor(category: string): string {
  const slot = SLOT_BY_CATEGORY[category];
  return slot ? `var(--series-${slot})` : "var(--text-muted)";
}
