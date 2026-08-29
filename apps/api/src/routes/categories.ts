import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { createDoc, deleteDoc, findDocs, updateDoc } from "../lib/defra.js";
import { BUILTIN_CATEGORIES, getCustomCategories } from "../services/categories.js";

const router = Router();
router.use(requireAuth);

// GET /categories — builtin + the user's custom categories
router.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const custom = await getCustomCategories(req.userId!);
    res.json({
      builtin: BUILTIN_CATEGORIES,
      custom,
      all: [...BUILTIN_CATEGORIES, ...custom.map((c) => c.name)],
    });
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

    await deleteDoc("Category", req.params.id!);
    res.json({ ok: true, reassignedTransactions: txns.length, reassignedMerchants: merchants.length });
  } catch (err) {
    next(err);
  }
});

export default router;
