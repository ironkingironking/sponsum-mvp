import { Router } from "express";
import { verifyAuthToken } from "../../lib/token.js";
import {
  createTransactionSchema,
  fundTransactionSchema,
  settleTransactionSchema,
  transferTransactionSchema
} from "./schemas.js";
import { transactionLifecycleService } from "./service.js";

export const transactionLifecycleRouter = Router();

function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token;
}

function resolveUserId(header: string | undefined): string | null {
  const token = extractBearerToken(header);
  if (!token) return null;
  const payload = verifyAuthToken(token);
  return payload?.userId ?? null;
}

transactionLifecycleRouter.post("/api/v1/transactions/create", async (req, res) => {
  try {
    const actorUserId = resolveUserId(req.headers.authorization);

    if (!actorUserId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const payload = createTransactionSchema.parse(req.body);
    const created = await transactionLifecycleService.create(payload, actorUserId);
    return res.status(201).json({ data: created });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Invalid create transaction request" });
  }
});

transactionLifecycleRouter.post("/api/v1/transactions/:claimId/fund", async (req, res) => {
  try {
    const actorUserId = resolveUserId(req.headers.authorization);

    if (!actorUserId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const payload = fundTransactionSchema.parse(req.body);
    const updated = await transactionLifecycleService.fund(req.params.claimId, payload, actorUserId);
    return res.json({ data: updated });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Invalid fund request" });
  }
});

transactionLifecycleRouter.post("/api/v1/transactions/:claimId/transfer", async (req, res) => {
  try {
    const actorUserId = resolveUserId(req.headers.authorization);

    if (!actorUserId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const payload = transferTransactionSchema.parse(req.body);
    const updated = await transactionLifecycleService.transfer(req.params.claimId, payload, actorUserId);
    return res.json({ data: updated });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Invalid transfer request" });
  }
});

transactionLifecycleRouter.post("/api/v1/transactions/:claimId/settle", async (req, res) => {
  try {
    const actorUserId = resolveUserId(req.headers.authorization);

    if (!actorUserId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const payload = settleTransactionSchema.parse(req.body);
    const updated = await transactionLifecycleService.settle(req.params.claimId, payload, actorUserId);
    return res.json({ data: updated });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Invalid settlement request" });
  }
});

transactionLifecycleRouter.get("/api/v1/transactions/:claimId", async (req, res) => {
  const transaction = await transactionLifecycleService.getByClaimId(req.params.claimId);
  if (!transaction) {
    return res.status(404).json({ error: "Transaction not found" });
  }

  return res.json({ data: transaction });
});
