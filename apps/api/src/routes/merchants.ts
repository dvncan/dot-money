import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { createDoc, deleteDoc, findDocs, updateDoc } from "../lib/defra.js";
import { invalidateMerchantCache } from "../services/categorizer.js";
import { assertAllowedCategory } from "../services/categories.js";
import { recategorizeUser } from "../services/recategorize.js";

const router = Router();
router.use(requireAuth);

// GET /merchants?mine=1 — built-in catalog + the user's own (or just theirs)
router.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const filter = req.query.mine
      ? { userId: { _eq: req.userId } }
      : { _or: [{ userId: { _eq: "" } }, { userId: { _eq: req.userId } }] };
    const rows = await findDocs<any>(
      "Merchant",
      ["name", "pattern", "category", "address", "city", "province", "country", "source"],
      { filter, limit: 5000 }
    );
    rows.sort((a: any, b: any) => a.name.localeCompare(b.name));
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /merchants/uncategorized — distinct merchants from the user's "Other"
// transactions, grouped with counts/totals. Assigning a category to one of
// these (via POST /merchants) sorts every transaction from that merchant.
router.get("/uncategorized", async (req: AuthedRequest, res, next) => {
  try {
    const txns = await findDocs<any>("Txn", ["merchant", "rawDescription", "amount", "date", "location"], {
      filter: { userId: { _eq: req.userId }, category: { _eq: "Other" } },
      limit: 10000,
    });
    const groups = new Map<string, { merchant: string; sample: string; txlist: any[] }>();
    for (const t of txns) {
      const key = t.merchant || "(no description)";
      const g = groups.get(key) ?? { merchant: key, sample: t.rawDescription ?? "", txlist: [] as any[] };
      g.txlist.push(t);
      groups.set(key, g);
    }
    res.json(
      [...groups.values()]
        .map((g) => {
          const sorted = g.txlist.sort((a, b) => b.date.localeCompare(a.date));
          const spends = sorted.filter((t) => t.amount > 0);
          const total = spends.reduce((s, t) => s + t.amount, 0);
          return {
            merchant: g.merchant,
            sample: g.sample,
            location: sorted.find((t) => t.location)?.location ?? "",
            count: sorted.length,
            total: Number(total.toFixed(2)),
            avg: spends.length ? Number((total / spends.length).toFixed(2)) : 0,
            firstDate: sorted[sorted.length - 1]?.date ?? "",
            lastDate: sorted[0]?.date ?? "",
            recent: sorted.slice(0, 5).map((t) => ({ date: t.date, amount: t.amount, rawDescription: t.rawDescription })),
          };
        })
        .sort((a, b) => b.count - a.count || b.total - a.total)
    );
  } catch (err) {
    next(err);
  }
});

// POST /merchants — add a personal merchant (e.g. a neighbourhood coffee shop),
// then re-categorize the user's existing transactions against it.
router.post("/", async (req: AuthedRequest, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(2),
      category: z.string().min(1),
      pattern: z.string().min(2).optional(),   // defaults to the name
      address: z.string().optional(),
      city: z.string().optional(),
      province: z.string().optional(),
      country: z.enum(["CA", "US"]).default("CA"),
      upsert: z.boolean().optional(), // true: update the existing rule's category instead of 409
    }).parse(req.body);
    await assertAllowedCategory(req.userId!, body.category);

    // pattern accepts one or more comma-separated match texts, e.g.
    // "united airlines, united payment, united travel"
    const patterns = [...new Set(
      (body.pattern ?? body.name)
        .split(",")
        .map((p) => p.trim().toLowerCase())
        .filter((p) => p.length >= 2)
    )];
    if (!patterns.length) return res.status(400).json({ error: "Each match text needs at least 2 characters" });
    const pattern = patterns.join(", ");

    // clash check against each of the user's existing patterns
    const mineRows = await findDocs<any>("Merchant", ["name", "pattern"], {
      filter: { userId: { _eq: req.userId } },
      limit: 5000,
    });
    const clash = mineRows.find((m: any) =>
      String(m.pattern).split(",").map((p: string) => p.trim().toLowerCase()).some((p: string) => patterns.includes(p))
    );
    if (clash) {
      if (!body.upsert) return res.status(409).json({ error: `"${clash.name}" already matches one of those texts` });
      await updateDoc("Merchant", clash._docID, { category: body.category });
      invalidateMerchantCache();
      const { updated } = await recategorizeUser(req.userId!);
      return res.json({ id: clash._docID, recategorized: updated, updatedExisting: true });
    }

    const id = await createDoc("Merchant", {
      name: body.name.trim(),
      pattern,
      category: body.category,
      address: body.address ?? "",
      city: body.city ?? "",
      province: body.province ?? "",
      country: body.country,
      source: "user",
      userId: req.userId,
      createdAt: new Date().toISOString(),
    });
    invalidateMerchantCache();
    const { updated } = await recategorizeUser(req.userId!);
    res.status(201).json({ id, recategorized: updated });
  } catch (err) {
    next(err);
  }
});

// PATCH /merchants/:id — edit one of the user's own merchants, then re-categorize.
router.patch("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(2).optional(),
      category: z.string().min(1).optional(),
      pattern: z.string().min(2).optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      province: z.string().optional(),
    }).parse(req.body);

    const owned = await findDocs<any>("Merchant", ["name"], {
      filter: { _docID: { _eq: req.params.id }, userId: { _eq: req.userId } },
      limit: 1,
    });
    if (!owned[0]) return res.status(404).json({ error: "Merchant not found (built-in entries can't be edited)" });
    if (body.category) await assertAllowedCategory(req.userId!, body.category);

    const input: Record<string, unknown> = { ...body };
    if (body.pattern !== undefined) {
      const patterns = [...new Set(body.pattern.split(",").map((p) => p.trim().toLowerCase()).filter((p) => p.length >= 2))];
      if (!patterns.length) return res.status(400).json({ error: "Each match text needs at least 2 characters" });
      const mineRows = await findDocs<any>("Merchant", ["name", "pattern"], {
        filter: { userId: { _eq: req.userId } },
        limit: 5000,
      });
      const clash = mineRows.find((m: any) =>
        m._docID !== req.params.id &&
        String(m.pattern).split(",").map((p: string) => p.trim().toLowerCase()).some((p: string) => patterns.includes(p))
      );
      if (clash) return res.status(409).json({ error: `"${clash.name}" already matches one of those texts` });
      input.pattern = patterns.join(", ");
    }

    await updateDoc("Merchant", req.params.id!, input);
    invalidateMerchantCache();
    const { updated } = await recategorizeUser(req.userId!);
    res.json({ ok: true, recategorized: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /merchants/:id — only the user's own entries
router.delete("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const owned = await findDocs<any>("Merchant", ["source"], {
      filter: { _docID: { _eq: req.params.id }, userId: { _eq: req.userId } },
      limit: 1,
    });
    if (!owned[0]) return res.status(404).json({ error: "Merchant not found (built-in entries can't be deleted)" });
    await deleteDoc("Merchant", req.params.id!);
    invalidateMerchantCache();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
