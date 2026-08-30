"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export const BUILTIN_CATEGORIES = [
  "Groceries", "Dining", "Streaming", "Software", "Fitness", "Telecom",
  "Utilities", "Transport", "Shopping", "Insurance", "Housing", "Income", "Other",
];

/** Categories for dropdowns + the user's color overrides, live from the API. */
export function useCategories() {
  const [categories, setCategories] = useState<string[]>(BUILTIN_CATEGORIES);
  const [custom, setCustom] = useState<Array<{ _docID: string; name: string }>>([]);
  const [styles, setStyles] = useState<Record<string, string>>({});
  const [hidden, setHidden] = useState<string[]>([]);
  const [dashboardHidden, setDashboardHidden] = useState<string[]>([]);

  const reload = useCallback(() => {
    api<any>("/categories")
      .then((d) => {
        setCategories(d.all);
        setCustom(d.custom);
        setStyles(d.styles ?? {});
        setHidden(d.hidden ?? []);
        setDashboardHidden(d.dashboardHidden ?? []);
      })
      .catch(() => {}); // keep builtin fallback on error
  }, []);
  useEffect(reload, [reload]);

  /** Switch a category on/off for the dashboard (optimistic). */
  const setVisible = useCallback(async (category: string, visible: boolean) => {
    setDashboardHidden((prev) =>
      visible ? prev.filter((c) => c !== category) : [...new Set([...prev, category])]
    );
    try {
      await api("/categories/visibility", { method: "POST", body: JSON.stringify({ category, visible }) });
    } finally {
      reload();
    }
  }, [reload]);

  return { categories, custom, styles, hidden, dashboardHidden, setVisible, reload };
}
