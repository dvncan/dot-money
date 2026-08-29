import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { findDocs, updateDoc } from "../lib/defra.js";
import { assertAllowedCategory } from "../services/categories.js";
import { recategorizeUser } from "../services/recategorize.js";

const router = Router();
router.use(requireAuth);

// GET /transactions?category=&merchant=&since=&limit=&offset=
router.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const filter: Record<string, unknown> = { userId: { _eq: req.userId } };
    if (typeof req.query.category === "string") filter.category = { _eq: req.query.category };
    if (typeof req.query.merchant === "string") filter.merchant = { _eq: req.query.merchant };
    const limit = Math.min(Number(req.query.limit ?? 100), 500);
    const offset = Number(req.query.offset ?? 0);
    let txns = await findDocs<any>(
      "Txn",
      ["date", "amount", "merchant", "rawDescription", "category", "subscriptionId", "flags", "source"],
      { filter, order: { date: "DESC" }, limit, offset }
    );
    // String dates lack range filters in DefraDB v1.0 — post-filter within the fetched page
    if (typeof req.query.since === "string") txns = txns.filter((t) => t.date > (req.query.since as string));
    res.json(txns);
  } catch (err) {
    next(err);
  }
});

// PATCH /transactions/:id — change a transaction's category. Budgets and the
// dashboard recompute from transactions on every read, so they pick this up
// automatically on the next fetch.
router.patch("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const { category } = z.object({ category: z.string().min(1) }).parse(req.body);
    await assertAllowedCategory(req.userId!, category);
    const owned = await findDocs<any>("Txn", ["category", "flags"], {
      filter: { _docID: { _eq: req.params.id }, userId: { _eq: req.userId } },
      limit: 1,
    });
    if (!owned[0]) return res.status(404).json({ error: "Transaction not found" });
    if (owned[0].category !== category) {
      // "manual-category" marks a per-transaction exception (e.g. food bought
      // from an airline): recategorization sweeps must never overwrite it.
      const flags: string[] = Array.isArray(owned[0].flags) ? owned[0].flags : [];
      if (!flags.includes("manual-category")) flags.push("manual-category");
      await updateDoc("Txn", req.params.id!, { category, flags });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /transactions/recategorize — re-run merchant-index categorization over
// all of the user's transactions (used after catalog/merchant changes).
router.post("/recategorize", async (req: AuthedRequest, res, next) => {
  try {
    res.json(await recategorizeUser(req.userId!));
  } catch (err) {
    next(err);
  }
});

export default router;
