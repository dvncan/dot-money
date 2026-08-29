import type { Request, Response, NextFunction } from "express";
import { DefraError } from "../lib/defra.js";
import { ZodError } from "zod";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Validation failed", issues: err.issues });
  }
  if (err instanceof Error && typeof (err as any).status === "number") {
    return res.status((err as any).status).json({ error: err.message });
  }
  if (err instanceof DefraError) {
    console.error("DefraDB error:", err.message, err.detail);
    return res.status(502).json({ error: `Data store error: ${err.message}` });
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
