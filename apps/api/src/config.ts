import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Load the repo-root .env regardless of cwd
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../../.env") });
dotenv.config(); // also allow a local .env override

export const config = {
  port: Number(process.env.API_PORT ?? 4000),
  defraUrl: process.env.DEFRA_URL ?? "http://127.0.0.1:9181",
  jwtSecret: process.env.JWT_SECRET ?? "dev-only-secret",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? "dev-only-refresh",
  accessTokenTtl: "30m",
  refreshTokenTtl: "14d",
  plaid: {
    clientId: process.env.PLAID_CLIENT_ID ?? "",
    secret: process.env.PLAID_SECRET ?? "",
    env: (process.env.PLAID_ENV ?? "sandbox") as "sandbox" | "development" | "production",
    get enabled() {
      return Boolean(this.clientId && this.secret);
    },
  },
};
