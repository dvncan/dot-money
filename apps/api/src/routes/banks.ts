import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { createLinkToken, exchangeAndStore, plaidEnabled, syncTransactions } from "../services/plaid.js";
import { importCsv } from "../services/csvImport.js";
import { deleteDoc, findDocs } from "../lib/defra.js";
import { runDetection } from "../services/subscriptionDetector.js";

const router = Router();
router.use(requireAuth);

const PLAID_DISABLED = {
  error: "Plaid is not configured. Set PLAID_CLIENT_ID and PLAID_SECRET in .env (sandbox keys are free), or use CSV import.",
};

router.post("/link-token", async (req: AuthedRequest, res, next) => {
  if (!plaidEnabled()) return res.status(503).json(PLAID_DISABLED);
  try {
    res.json({ linkToken: await createLinkToken(req.userId!) });
  } catch (err) {
    next(err);
  }
});

router.post("/exchange", async (req: AuthedRequest, res, next) => {
  if (!plaidEnabled()) return res.status(503).json(PLAID_DISABLED);
  try {
    const { publicToken } = z.object({ publicToken: z.string() }).parse(req.body);
    const accountIds = await exchangeAndStore(req.userId!, publicToken);
    const imported = await syncTransactions(req.userId!);
    await runDetection(req.userId!);
    res.json({ accountIds, transactionsImported: imported });
  } catch (err) {
    next(err);
  }
});

router.post("/sync", async (req: AuthedRequest, res, next) => {
  if (!plaidEnabled()) return res.status(503).json(PLAID_DISABLED);
  try {
    const imported = await syncTransactions(req.userId!);
    await runDetection(req.userId!);
    res.json({ transactionsImported: imported });
  } catch (err) {
    next(err);
  }
});

router.get("/accounts", async (req: AuthedRequest, res, next) => {
  try {
    const accounts = await findDocs<any>(
      "BankAccount",
      ["institution", "accountName", "accountType", "mask", "source", "createdAt"],
      { filter: { userId: { _eq: req.userId } } }
    );
    res.json(accounts);
  } catch (err) {
    next(err);
  }
});

router.delete("/accounts/:id", async (req: AuthedRequest, res, next) => {
  try {
    const owned = await findDocs<any>("BankAccount", ["userId"], {
      filter: { _docID: { _eq: req.params.id }, userId: { _eq: req.userId } },
      limit: 1,
    });
    if (!owned[0]) return res.status(404).json({ error: "Account not found" });
    await deleteDoc("BankAccount", req.params.id!);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// CSV fallback: body { csv: "...", label?: "RBC chequing" }
router.post("/import-csv", async (req: AuthedRequest, res, next) => {
  try {
    const { csv, label } = z.object({ csv: z.string().min(10), label: z.string().optional() }).parse(req.body);
    const result = await importCsv(req.userId!, csv, label);
    await runDetection(req.userId!);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
