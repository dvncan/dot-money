import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { createDoc, deleteDoc, findDocs, updateDoc } from "../lib/defra.js";
import { getUserTxns } from "../services/analysis.js";
import { assertAllowedCategory } from "../services/categories.js";

const router = Router();
router.use(requireAuth);

// GET /budgets — each with current-month progress
router.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const budgets = await findDocs<any>("Budget", ["category", "limit", "period", "createdAt"], {
      filter: { userId: { _eq: req.userId } },
    });
    const monthStart = new Date();
    monthStart.setDate(1);
    const txns = await getUserTxns(req.userId!, monthStart.toISOString().slice(0, 10));
    const spentByCategory = new Map<string, number>();
    for (const t of txns) {
      if (t.amount > 0) spentByCategory.set(t.category, (spentByCategory.get(t.category) ?? 0) + t.amount);
    }
    res.json(
      budgets.map((b: any) => {
        const spent = Number((spentByCategory.get(b.category) ?? 0).toFixed(2));
        return { ...b, spent, remaining: Number((b.limit - spent).toFixed(2)), pct: b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0 };
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req: AuthedRequest, res, next) => {
  try {
    const body = z.object({ category: z.string().min(1), limit: z.number().positive() }).parse(req.body);
    await assertAllowedCategory(req.userId!, body.category);
    const existing = await findDocs<any>("Budget", ["category"], {
      filter: { userId: { _eq: req.userId }, category: { _eq: body.category } },
      limit: 1,
    });
    if (existing[0]) return res.status(409).json({ error: `A budget for ${body.category} already exists` });
    const id = await createDoc("Budget", {
      userId: req.userId, category: body.category, limit: body.limit, period: "monthly",
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const owned = await findDocs<any>("Budget", ["userId"], {
      filter: { _docID: { _eq: req.params.id }, userId: { _eq: req.userId } }, limit: 1,
    });
    if (!owned[0]) return res.status(404).json({ error: "Not found" });
    const body = z.object({ limit: z.number().positive() }).parse(req.body);
    await updateDoc("Budget", req.params.id!, { limit: body.limit });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const owned = await findDocs<any>("Budget", ["userId"], {
      filter: { _docID: { _eq: req.params.id }, userId: { _eq: req.userId } }, limit: 1,
    });
    if (!owned[0]) return res.status(404).json({ error: "Not found" });
    await deleteDoc("Budget", req.params.id!);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
