import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { health } from "./lib/defra.js";
import { errorHandler } from "./middleware/error.js";
import authRouter from "./routes/auth.js";
import banksRouter from "./routes/banks.js";
import transactionsRouter from "./routes/transactions.js";
import subscriptionsRouter from "./routes/subscriptions.js";
import cancellationsRouter from "./routes/cancellations.js";
import budgetsRouter from "./routes/budgets.js";
import analysisRouter from "./routes/analysis.js";
import merchantsRouter from "./routes/merchants.js";
import categoriesRouter from "./routes/categories.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" })); // CSV uploads come through JSON

app.get("/health", async (_req, res) => {
  const defraUp = await health();
  res.status(defraUp ? 200 : 503).json({ api: "ok", defra: defraUp ? "ok" : "unreachable" });
});

app.use("/auth", authRouter);
app.use("/user", authRouter); // /user/profile lives on the auth router
app.use("/banks", banksRouter);
app.use("/transactions", transactionsRouter);
app.use("/subscriptions", subscriptionsRouter);
app.use("/cancellation-requests", cancellationsRouter);
app.use("/budgets", budgetsRouter);
app.use("/merchants", merchantsRouter);
app.use("/categories", categoriesRouter);
app.use("/spending-analysis", analysisRouter);

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`FinShield API listening on http://localhost:${config.port}`);
  console.log(`DefraDB expected at ${config.defraUrl}`);
  if (!config.plaid.enabled) {
    console.log("Plaid keys not set — bank linking disabled, CSV import available.");
  }
});
