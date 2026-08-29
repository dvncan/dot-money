import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { anomalies, dashboard, opportunities } from "../services/analysis.js";

const router = Router();
router.use(requireAuth);

router.get("/dashboard", async (req: AuthedRequest, res, next) => {
  try {
    res.json(await dashboard(req.userId!));
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
