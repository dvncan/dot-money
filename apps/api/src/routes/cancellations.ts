import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { createDoc, findDocs, updateDoc } from "../lib/defra.js";
import { PROVINCES, TEMPLATES, renderLetter } from "../services/templates.js";

const router = Router();

router.get("/templates", (_req, res) => {
  res.json({
    templates: TEMPLATES.map(({ body: _body, ...meta }) => meta),
    provinces: PROVINCES,
    disclaimer: "These templates are general consumer self-advocacy tools, not legal advice. For legal advice specific to your situation, consult a lawyer or your provincial consumer protection office.",
  });
});

router.use(requireAuth);

// Generate a letter (and create a draft CancellationRequest)
router.post("/", async (req: AuthedRequest, res, next) => {
  try {
    const body = z.object({
      subscriptionId: z.string().optional(),
      vendor: z.string().min(1),
      templateId: z.string(),
      amount: z.number().optional(),
      chargeDate: z.string().optional(),
      cancellationDate: z.string().optional(),
    }).parse(req.body);

    const users = await findDocs<any>("User", ["email", "name", "province"], {
      filter: { _docID: { _eq: req.userId } },
      limit: 1,
    });
    const user = users[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    const { content, responseDeadline } = renderLetter(body.templateId, {
      name: user.name || user.email,
      email: user.email,
      vendor: body.vendor,
      province: user.province || "ON",
      amount: body.amount,
      chargeDate: body.chargeDate,
      cancellationDate: body.cancellationDate,
    });

    const id = await createDoc("CancellationRequest", {
      userId: req.userId,
      subscriptionId: body.subscriptionId ?? "",
      vendor: body.vendor,
      templateId: body.templateId,
      letterContent: content,
      sentDate: "",
      responseDeadline,
      status: "draft",
      refundAmount: body.amount ?? 0,
      refundStatus: "none",
      province: user.province || "ON",
      createdAt: new Date().toISOString(),
    });

    if (body.subscriptionId) {
      await updateDoc("Sub", body.subscriptionId, { status: "pending_cancel" });
    }
    res.status(201).json({ id, letterContent: content, responseDeadline });
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const rows = await findDocs<any>(
      "CancellationRequest",
      ["subscriptionId", "vendor", "templateId", "letterContent", "sentDate", "responseDeadline", "status", "refundAmount", "refundStatus", "createdAt"],
      { filter: { userId: { _eq: req.userId } }, order: { createdAt: "DESC" }, limit: 200 }
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Update status: mark sent / responded / resolved, record refund outcome
router.patch("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const owned = await findDocs<any>("CancellationRequest", ["subscriptionId", "status"], {
      filter: { _docID: { _eq: req.params.id }, userId: { _eq: req.userId } },
      limit: 1,
    });
    if (!owned[0]) return res.status(404).json({ error: "Not found" });

    const body = z.object({
      status: z.enum(["draft", "sent", "responded", "resolved"]).optional(),
      refundStatus: z.enum(["none", "requested", "received", "denied"]).optional(),
      refundAmount: z.number().optional(),
    }).parse(req.body);

    const input: Record<string, unknown> = { ...body };
    if (body.status === "sent" && owned[0].status === "draft") {
      input.sentDate = new Date().toISOString().slice(0, 10);
    }
    await updateDoc("CancellationRequest", req.params.id!, input);

    if (body.status === "resolved" && owned[0].subscriptionId) {
      await updateDoc("Sub", owned[0].subscriptionId, { status: "cancelled" });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
