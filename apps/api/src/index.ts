import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./lib/env.js";
import { authRouter } from "./modules/auth/route.js";
import { usersRouter } from "./modules/users/route.js";
import { claimsRouter } from "./modules/claims/route.js";
import { templatesRouter } from "./modules/templates/route.js";
import { marketplaceRouter } from "./modules/marketplace/route.js";
import { settlementsRouter } from "./modules/settlements/route.js";
import { disputesRouter } from "./modules/disputes/route.js";
import { trustRouter } from "./modules/trust/route.js";
import { collateralRouter } from "./modules/collateral/route.js";
import { escrowRouter } from "./modules/escrow/route.js";
import { custodyRouter } from "./modules/custody/route.js";
import { eventsRouter } from "./modules/events/route.js";
import { transactionLifecycleRouter } from "./modules/transaction-lifecycle/route.js";

const app = express();
const port = env.API_PORT;

app.disable("x-powered-by");
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true
  })
);
app.use(helmet());
app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "sponsum-api" });
});

app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/claims", claimsRouter);
app.use("/templates", templatesRouter);
app.use("/marketplace", marketplaceRouter);
app.use("/disputes", disputesRouter);
app.use("/trust", trustRouter);
app.use("/collateral", collateralRouter);
app.use("/escrow", escrowRouter);
app.use("/custody", custodyRouter);
app.use("/events", eventsRouter);
app.use(transactionLifecycleRouter);

// Claim-scoped module routes
app.use("/claims", settlementsRouter);
app.use("/claims", eventsRouter);
app.use("/claims", collateralRouter);
app.use("/claims", escrowRouter);
app.use("/claims", custodyRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (env.NODE_ENV !== "production") {
    console.error(error);
  }
  res.status(500).json({ error: "Internal server error" });
});

app.listen(port, () => {
  console.log(`Sponsum API running on http://localhost:${port}`);
});
