"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export const BUILTIN_CATEGORIES = [
  "Groceries", "Dining", "Streaming", "Software", "Fitness", "Telecom",
  "Utilities", "Transport", "Shopping", "Insurance", "Housing", "Income", "Other",
];

/** Categories for dropdowns: builtin + the user's custom ones, live from the API. */
export function useCategories() {
  const [categories, setCategories] = useState<string[]>(BUILTIN_CATEGORIES);
  const [custom, setCustom] = useState<Array<{ _docID: string; name: string }>>([]);

  const reload = useCallback(() => {
    api<any>("/categories")
      .then((d) => {
        setCategories(d.all);
        setCustom(d.custom);
      })
      .catch(() => {}); // keep builtin fallback on error
  }, []);
  useEffect(reload, [reload]);

  return { categories, custom, reload };
}
