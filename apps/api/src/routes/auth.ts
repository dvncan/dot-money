import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.js";
import { createDoc, findDocs, updateDoc } from "../lib/defra.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

const router = Router();

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
  province: z.string().length(2).optional(),
});

function issueTokens(userId: string) {
  const accessToken = jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: config.accessTokenTtl } as jwt.SignOptions);
  const refreshToken = jwt.sign({ sub: userId, kind: "refresh" }, config.jwtRefreshSecret, { expiresIn: config.refreshTokenTtl } as jwt.SignOptions);
  return { accessToken, refreshToken };
}

async function findUserByEmail(email: string) {
  const users = await findDocs<any>("User", ["email", "passwordHash", "name", "province"], {
    filter: { email: { _eq: email.toLowerCase() } },
    limit: 1,
  });
  return users[0] ?? null;
}

router.post("/register", async (req, res, next) => {
  try {
    const body = credentials.parse(req.body);
    const email = body.email.toLowerCase();
    if (await findUserByEmail(email)) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    const userId = await createDoc("User", {
      email,
      passwordHash: await bcrypt.hash(body.password, 10),
      name: body.name ?? "",
      province: (body.province ?? "ON").toUpperCase(),
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ userId, ...issueTokens(userId) });
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const body = credentials.pick({ email: true, password: true }).parse(req.body);
    const user = await findUserByEmail(body.email);
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    res.json({ userId: user._docID, name: user.name, province: user.province, ...issueTokens(user._docID) });
  } catch (err) {
    next(err);
  }
});

router.post("/refresh-token", async (req, res) => {
  const token = z.object({ refreshToken: z.string() }).parse(req.body).refreshToken;
  try {
    const payload = jwt.verify(token, config.jwtRefreshSecret) as { sub: string; kind?: string };
    if (payload.kind !== "refresh") throw new Error("wrong token kind");
    res.json(issueTokens(payload.sub));
  } catch {
    res.status(401).json({ error: "Invalid refresh token" });
  }
});

router.get("/profile", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const users = await findDocs<any>("User", ["email", "name", "province", "createdAt"], {
      filter: { _docID: { _eq: req.userId } },
      limit: 1,
    });
    if (!users[0]) return res.status(404).json({ error: "User not found" });
    const { passwordHash: _ph, ...safe } = users[0];
    res.json(safe);
  } catch (err) {
    next(err);
  }
});

router.patch("/profile", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const body = z.object({ name: z.string().optional(), province: z.string().length(2).optional() }).parse(req.body);
    const input: Record<string, unknown> = {};
    if (body.name !== undefined) input.name = body.name;
    if (body.province !== undefined) input.province = body.province.toUpperCase();
    if (Object.keys(input).length) await updateDoc("User", req.userId!, input);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
