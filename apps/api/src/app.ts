import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./lib/env.js";
import { sponsumRouter } from "./modules/sponsum/route.js";

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/sponsum");

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true
    })
  );
  app.use(
    helmet({
      contentSecurityPolicy: false
    })
  );
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

  app.use("/api/sponsum/v1", sponsumRouter);
  app.use("/sponsum", express.static(publicDir, { index: "index.html", fallthrough: true }));
  app.get(["/sponsum", "/sponsum/"], (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (env.NODE_ENV !== "production") {
      console.error(error);
    }
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
