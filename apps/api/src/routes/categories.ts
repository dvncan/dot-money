import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { createDoc, deleteDoc, findDocs, updateDoc } from "../lib/defra.js";
import { BUILTIN_CATEGORIES, DEFAULT_SLOTS, getAllowedCategories, getCustomCategories, getDisplayBuiltins } from "../services/categories.js";
import { getCategoryAliases, invalidateMerchantCache } from "../services/categorizer.js";

/** Resolve a display name back to its original builtin name, if it is one. */
async function originalBuiltinFor(userId: string, displayName: string): Promise<string | null> {
  const aliases = await getCategoryAliases(userId);
  for (const b of BUILTIN_CATEGORIES) {
    if ((aliases[b] ?? b) === displayName && aliases[b] !== "") return b;
  }
  return null;
}

/** Rewrite category name across the user's txns, own merchants, budgets, styles. */
async function cascadeRename(userId: string, from: string, to: string) {
  const txns = await findDocs<any>("Txn", ["category"], {
    filter: { userId: { _eq: userId }, category: { _eq: from } }, limit: 10000,
  });
  for (const t of txns) await updateDoc("Txn", t._docID, { category: to });
  const merchants = await findDocs<any>("Merchant", ["category"], {
    filter: { userId: { _eq: userId }, category: { _eq: from } }, limit: 5000,
  });
  for (const m of merchants) await updateDoc("Merchant", m._docID, { category: to });
  const budgets = await findDocs<any>("Budget", ["category"], {
    filter: { userId: { _eq: userId }, category: { _eq: from } }, limit: 500,
  });
  for (const b of budgets) await updateDoc("Budget", b._docID, { category: to });
  const styles = await findDocs<any>("CategoryStyle", ["category", "color"], {
    filter: { userId: { _eq: userId }, category: { _eq: from } }, limit: 5,
  });
  for (const s of styles) {
    if (to === "Other") await deleteDoc("CategoryStyle", s._docID);
    else await updateDoc("CategoryStyle", s._docID, { category: to });
  }
  return { txns: txns.length, hadStyle: styles.length > 0 };
}

const router = Router();
router.use(requireAuth);

// GET /categories — builtin + the user's custom categories, plus their color
// overrides ("slot:N" = theme-aware palette slot, "#rrggbb" = fixed hex)
router.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const [custom, builtins] = await Promise.all([
      getCustomCategories(req.userId!),
      getDisplayBuiltins(req.userId!),
    ]);
    const styleRows = await findDocs<any>("CategoryStyle", ["category", "color", "dashboardHidden"], {
      filter: { userId: { _eq: req.userId } },
      limit: 500,
    });
    const styles: Record<string, string> = {};
    const dashboardHidden: string[] = [];
    for (const s of styleRows) {
      if (s.color) styles[s.category] = s.color;
      if (s.dashboardHidden === "1") dashboardHidden.push(s.category);
    }
    const aliases = await getCategoryAliases(req.userId!);
    const hidden = BUILTIN_CATEGORIES.filter((b) => aliases[b] === "");
    res.json({
      builtin: builtins,
      custom,
      all: [...builtins, ...custom.map((c) => c.name)],
      styles,
      hidden,
      dashboardHidden,
    });
  } catch (err) {
    next(err);
  }
});

// POST /categories/rename — rename any category (builtin renames are stored as
// per-user aliases; custom ones rename in place). Cascades across transactions,
// merchants, budgets, and color overrides. "Other" is the system fallback
// bucket and cannot be renamed.
router.post("/rename", async (req: AuthedRequest, res, next) => {
  try {
    const { from, to } = z.object({
      from: z.string().min(1),
      to: z.string().trim().min(2).max(24).regex(/^[\p{L}][\p{L}\p{N} &/'-]*$/u, "Letters, numbers, spaces and &/'- only"),
    }).parse(req.body);
    if (from === "Other") return res.status(400).json({ error: `"Other" is the fallback bucket and can't be renamed` });
    if (from === to) return res.json({ ok: true, unchanged: true });

    const allowed = await getAllowedCategories(req.userId!);
    if (!allowed.includes(from)) return res.status(404).json({ error: `Unknown category "${from}"` });
    if (allowed.some((c) => c !== from && c.toLowerCase() === to.toLowerCase())) {
      return res.status(409).json({ error: `Category "${to}" already exists` });
    }

    const customDoc = (await getCustomCategories(req.userId!)).find((c) => c.name === from);
    const builtin = customDoc ? null : await originalBuiltinFor(req.userId!, from);
    if (customDoc) {
      await updateDoc("Category", customDoc._docID, { name: to });
    } else if (builtin) {
      const aliasRows = await findDocs<any>("CategoryAlias", ["from"], {
        filter: { userId: { _eq: req.userId }, from: { _eq: builtin } }, limit: 1,
      });
      if (to === builtin && aliasRows[0]) {
        await deleteDoc("CategoryAlias", aliasRows[0]._docID); // renamed back to original
      } else if (aliasRows[0]) {
        await updateDoc("CategoryAlias", aliasRows[0]._docID, { to });
      } else {
        await createDoc("CategoryAlias", { userId: req.userId, from: builtin, to, createdAt: new Date().toISOString() });
      }
    } else {
      return res.status(404).json({ error: `Unknown category "${from}"` });
    }

    const { txns, hadStyle } = await cascadeRename(req.userId!, from, to);
    // a renamed builtin keeps its default color unless the user already overrode it
    if (builtin && !hadStyle && DEFAULT_SLOTS[builtin] && to !== builtin) {
      await createDoc("CategoryStyle", {
        userId: req.userId, category: to, color: `slot:${DEFAULT_SLOTS[builtin]}`,
        createdAt: new Date().toISOString(),
      });
    }
    invalidateMerchantCache();
    res.json({ ok: true, renamedTransactions: txns });
  } catch (err) {
    next(err);
  }
});

// POST /categories/delete — delete any category by display name. Custom ones
// are removed; builtins are hidden for this user (alias to ""). Transactions
// and the user's merchants move to "Other"; refused while a budget uses it.
router.post("/delete", async (req: AuthedRequest, res, next) => {
  try {
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
    if (name === "Other") return res.status(400).json({ error: `"Other" is the fallback bucket and can't be deleted` });

    const budgets = await findDocs<any>("Budget", ["category"], {
      filter: { userId: { _eq: req.userId }, category: { _eq: name } }, limit: 1,
    });
    if (budgets[0]) return res.status(409).json({ error: `A budget uses "${name}" — delete that budget first` });

    const customDoc = (await getCustomCategories(req.userId!)).find((c) => c.name === name);
    const builtin = customDoc ? null : await originalBuiltinFor(req.userId!, name);
    if (!customDoc && !builtin) return res.status(404).json({ error: `Unknown category "${name}"` });

    const { txns } = await cascadeRename(req.userId!, name, "Other");
    if (customDoc) {
      await deleteDoc("Category", customDoc._docID);
    } else if (builtin) {
      const aliasRows = await findDocs<any>("CategoryAlias", ["from"], {
        filter: { userId: { _eq: req.userId }, from: { _eq: builtin } }, limit: 1,
      });
      if (aliasRows[0]) await updateDoc("CategoryAlias", aliasRows[0]._docID, { to: "" });
      else await createDoc("CategoryAlias", { userId: req.userId, from: builtin, to: "", createdAt: new Date().toISOString() });
    }
    invalidateMerchantCache();
    res.json({ ok: true, reassignedTransactions: txns, hiddenBuiltin: Boolean(builtin) });
  } catch (err) {
    next(err);
  }
});

// POST /categories/restore — bring back a hidden builtin category.
router.post("/restore", async (req: AuthedRequest, res, next) => {
  try {
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
    const rows = await findDocs<any>("CategoryAlias", ["from", "to"], {
      filter: { userId: { _eq: req.userId }, from: { _eq: name } },
      limit: 1,
    });
    if (!rows[0] || rows[0].to !== "") return res.status(404).json({ error: `"${name}" isn't hidden` });
    await deleteDoc("CategoryAlias", rows[0]._docID);
    invalidateMerchantCache();
    res.json({ ok: true, name });
  } catch (err) {
    next(err);
  }
});

// POST /categories/reset — return a category to its original state: a renamed
// builtin gets its original name back (cascading through txns/merchants/budgets)
// and any color override is removed. Custom categories just lose their color
// override (they have no "original" beyond what the user created).
router.post("/reset", async (req: AuthedRequest, res, next) => {
  try {
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
    let finalName = name;

    if (name !== "Other") {
      const customDoc = (await getCustomCategories(req.userId!)).find((c) => c.name === name);
      const builtin = customDoc ? null : await originalBuiltinFor(req.userId!, name);
      if (!customDoc && !builtin) return res.status(404).json({ error: `Unknown category "${name}"` });

      if (builtin && builtin !== name) {
        const aliasRows = await findDocs<any>("CategoryAlias", ["from"], {
          filter: { userId: { _eq: req.userId }, from: { _eq: builtin } }, limit: 1,
        });
        if (aliasRows[0]) await deleteDoc("CategoryAlias", aliasRows[0]._docID);
        await cascadeRename(req.userId!, name, builtin);
        finalName = builtin;
      }
    }

    const styles = await findDocs<any>("CategoryStyle", ["category"], {
      filter: { userId: { _eq: req.userId }, category: { _eq: finalName } }, limit: 5,
    });
    for (const s of styles) await deleteDoc("CategoryStyle", s._docID);

    invalidateMerchantCache();
    res.json({ ok: true, name: finalName, renamed: finalName !== name });
  } catch (err) {
    next(err);
  }
});

// POST /categories/style — set (or reset) a category's color for this user.
// color: "slot:1".."slot:8" | "#rrggbb" | "default" (removes the override)
router.post("/style", async (req: AuthedRequest, res, next) => {
  try {
    const { category, color } = z.object({
      category: z.string().min(1),
      color: z.string().regex(/^(slot:[1-8]|#[0-9a-fA-F]{6}|default)$/, "Use slot:1–8, #rrggbb, or default"),
    }).parse(req.body);

    const allowed = await getAllowedCategories(req.userId!);
    if (!allowed.includes(category)) return res.status(400).json({ error: `Unknown category "${category}"` });

    const existing = await findDocs<any>("CategoryStyle", ["category", "dashboardHidden"], {
      filter: { userId: { _eq: req.userId }, category: { _eq: category } },
      limit: 1,
    });
    if (color === "default") {
      // the row also carries dashboard visibility — only drop it if that is unset
      if (existing[0]) {
        if (existing[0].dashboardHidden === "1") await updateDoc("CategoryStyle", existing[0]._docID, { color: "" });
        else await deleteDoc("CategoryStyle", existing[0]._docID);
      }
    } else if (existing[0]) {
      await updateDoc("CategoryStyle", existing[0]._docID, { color });
    } else {
      await createDoc("CategoryStyle", {
        userId: req.userId,
        category,
        color,
        dashboardHidden: "",
        createdAt: new Date().toISOString(),
      });
    }
    res.json({ ok: true, category, color });
  } catch (err) {
    next(err);
  }
});

// POST /categories/visibility — switch a category on/off for dashboard charts.
// Hidden categories still categorize transactions; they're just excluded from
// the dashboard's totals and breakdown.
router.post("/visibility", async (req: AuthedRequest, res, next) => {
  try {
    const { category, visible } = z.object({
      category: z.string().min(1),
      visible: z.boolean(),
    }).parse(req.body);

    const allowed = await getAllowedCategories(req.userId!);
    if (!allowed.includes(category)) return res.status(400).json({ error: `Unknown category "${category}"` });

    const existing = await findDocs<any>("CategoryStyle", ["category", "color"], {
      filter: { userId: { _eq: req.userId }, category: { _eq: category } },
      limit: 1,
    });
    const flag = visible ? "" : "1";
    if (existing[0]) {
      // no color and now visible again -> the row carries nothing, drop it
      if (visible && !existing[0].color) await deleteDoc("CategoryStyle", existing[0]._docID);
      else await updateDoc("CategoryStyle", existing[0]._docID, { dashboardHidden: flag });
    } else if (!visible) {
      await createDoc("CategoryStyle", {
        userId: req.userId,
        category,
        color: "",
        dashboardHidden: flag,
        createdAt: new Date().toISOString(),
      });
    }
    res.json({ ok: true, category, visible });
  } catch (err) {
    next(err);
  }
});

// POST /categories — add a custom category
router.post("/", async (req: AuthedRequest, res, next) => {
  try {
    const { name } = z.object({
      name: z.string().trim().min(2).max(24).regex(/^[\p{L}][\p{L}\p{N} &/'-]*$/u, "Letters, numbers, spaces and &/'- only"),
    }).parse(req.body);

    const existing = [...BUILTIN_CATEGORIES, ...(await getCustomCategories(req.userId!)).map((c) => c.name)];
    if (existing.some((c) => c.toLowerCase() === name.toLowerCase())) {
      return res.status(409).json({ error: `Category "${name}" already exists` });
    }
    const id = await createDoc("Category", {
      name,
      userId: req.userId,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ id, name });
  } catch (err) {
    next(err);
  }
});

// DELETE /categories/:id — refuses while a budget uses it; transactions and
// merchants using it are reassigned to "Other".
router.delete("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const owned = await findDocs<any>("Category", ["name"], {
      filter: { _docID: { _eq: req.params.id }, userId: { _eq: req.userId } },
      limit: 1,
    });
    if (!owned[0]) return res.status(404).json({ error: "Category not found (built-ins can't be deleted)" });
    const name = owned[0].name;

    const budgets = await findDocs<any>("Budget", ["category"], {
      filter: { userId: { _eq: req.userId }, category: { _eq: name } },
      limit: 1,
    });
    if (budgets[0]) {
      return res.status(409).json({ error: `A budget uses "${name}" — delete that budget first` });
    }

    const txns = await findDocs<any>("Txn", ["category"], {
      filter: { userId: { _eq: req.userId }, category: { _eq: name } },
      limit: 10000,
    });
    for (const t of txns) await updateDoc("Txn", t._docID, { category: "Other" });
    const merchants = await findDocs<any>("Merchant", ["category"], {
      filter: { userId: { _eq: req.userId }, category: { _eq: name } },
      limit: 5000,
    });
    for (const m of merchants) await updateDoc("Merchant", m._docID, { category: "Other" });

    // drop any color override the deleted category had
    const styles = await findDocs<any>("CategoryStyle", ["category"], {
      filter: { userId: { _eq: req.userId }, category: { _eq: name } },
      limit: 5,
    });
    for (const s of styles) await deleteDoc("CategoryStyle", s._docID);

    await deleteDoc("Category", req.params.id!);
    res.json({ ok: true, reassignedTransactions: txns.length, reassignedMerchants: merchants.length });
  } catch (err) {
    next(err);
  }
});

export default router;
