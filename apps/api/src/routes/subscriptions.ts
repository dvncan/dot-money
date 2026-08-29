import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { createDoc, deleteDoc, findDocs, updateDoc } from "../lib/defra.js";
import { monthlyCost, runDetection } from "../services/subscriptionDetector.js";

const router = Router();
router.use(requireAuth);

const SUB_FIELDS = ["vendor", "category", "cost", "billingCycle", "nextBillingDate", "status", "detectedBy", "firstSeen", "lastSeen", "occurrences"];

async function ownedSub(userId: string, id: string) {
  const rows = await findDocs<any>("Sub", SUB_FIELDS, {
    filter: { _docID: { _eq: id }, userId: { _eq: userId } },
    limit: 1,
  });
  return rows[0] ?? null;
}

router.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const subs = await runDetection(req.userId!); // re-detect on read (cheap at MVP scale)
    res.json(subs.map((s: any) => ({ ...s, monthlyCost: Number(monthlyCost(s).toFixed(2)) })));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req: AuthedRequest, res, next) => {
  try {
    const body = z.object({
      vendor: z.string().min(1),
      category: z.string().default("Other"),
      cost: z.number().positive(),
      billingCycle: z.enum(["weekly", "monthly", "yearly"]).default("monthly"),
      nextBillingDate: z.string().optional(),
    }).parse(req.body);
    const now = new Date().toISOString();
    const id = await createDoc("Sub", {
      userId: req.userId,
      ...body,
      nextBillingDate: body.nextBillingDate ?? "",
      status: "active",
      detectedBy: "manual",
      firstSeen: now.slice(0, 10),
      lastSeen: now.slice(0, 10),
      occurrences: 0,
      createdAt: now,
    });
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req: AuthedRequest, res, next) => {
  try {
    if (!(await ownedSub(req.userId!, req.params.id!))) return res.status(404).json({ error: "Not found" });
    const body = z.object({
      status: z.enum(["active", "pending_cancel", "cancelled"]).optional(),
      cost: z.number().positive().optional(),
      category: z.string().optional(),
    }).parse(req.body);
    await updateDoc("Sub", req.params.id!, body);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: AuthedRequest, res, next) => {
  try {
    if (!(await ownedSub(req.userId!, req.params.id!))) return res.status(404).json({ error: "Not found" });
    await deleteDoc("Sub", req.params.id!);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
