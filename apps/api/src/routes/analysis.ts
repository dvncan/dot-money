import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { anomalies, dashboard, merchantSpend, opportunities } from "../services/analysis.js";

const router = Router();
router.use(requireAuth);

// GET /spending-analysis/dashboard?period=week|month&count=N&accountId=
//   count is how many buckets back (1–104); 0 means all time.
//   Legacy ?months=N is still accepted.
router.get("/dashboard", async (req: AuthedRequest, res, next) => {
  try {
    const period = req.query.period === "week" ? "week" : "month";
    const raw = req.query.count !== undefined ? Number(req.query.count) : Number(req.query.months);
    const count = Number.isFinite(raw) && raw >= 0 ? Math.min(Math.trunc(raw), 104) : 6;
    const accountId = typeof req.query.accountId === "string" && req.query.accountId ? req.query.accountId : undefined;
    res.json(await dashboard(req.userId!, { period, count, accountId }));
  } catch (err) {
    next(err);
  }
});

// GET /spending-analysis/merchants?accountId=&since=  — per-merchant spend
// rollup powering the merchant filter and the merchant detail card.
router.get("/merchants", async (req: AuthedRequest, res, next) => {
  try {
    const accountId = typeof req.query.accountId === "string" && req.query.accountId ? req.query.accountId : undefined;
    const since = typeof req.query.since === "string" ? req.query.since : undefined;
    res.json(await merchantSpend(req.userId!, { accountId, since }));
  } catch (err) {
    next(err);
  }
});

router.get("/anomalies", async (req: AuthedRequest, res, next) => {
  try {
    res.json(await anomalies(req.userId!));
  } catch (err) {
    next(err);
  }
});

router.get("/opportunities", async (req: AuthedRequest, res, next) => {
  try {
    res.json(await opportunities(req.userId!));
  } catch (err) {
    next(err);
  }
});

export default router;
