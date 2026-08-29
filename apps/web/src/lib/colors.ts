/**
 * Category → color resolution.
 *
 * Default assignment is fixed (color follows the entity, never its rank): a
 * category keeps its slot no matter how data is filtered or sorted; categories
 * without a slot fold to a muted gray. Users can override per category via
 * CategoryStyle: "slot:N" picks a theme-aware palette slot (adapts to dark
 * mode), "#rrggbb" is a fixed hex.
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

export function categoryColor(category: string, overrides?: Record<string, string>): string {
  const override = overrides?.[category];
  if (override) {
    if (override.startsWith("slot:")) return `var(--series-${override.slice(5)})`;
    return override; // fixed hex
  }
  const slot = SLOT_BY_CATEGORY[category];
  return slot ? `var(--series-${slot})` : "var(--text-muted)";
}
