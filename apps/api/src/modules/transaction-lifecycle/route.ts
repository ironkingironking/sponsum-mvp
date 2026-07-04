import { Router } from "express";
import { getAuthenticatedUserId, requireAuth } from "../../lib/auth.js";
import { errorResponse } from "../../lib/http-error.js";
import {
  createTransactionSchema,
  fundTransactionSchema,
  settleTransactionSchema,
  transferTransactionSchema
} from "./schemas.js";
import { transactionLifecycleService } from "./service.js";

export const transactionLifecycleRouter = Router();

transactionLifecycleRouter.post("/api/v1/transactions/create", requireAuth, async (req, res) => {
  try {
    const payload = createTransactionSchema.parse(req.body);
    const created = await transactionLifecycleService.create(payload, getAuthenticatedUserId(req));
    return res.status(201).json({ data: created });
  } catch (error) {
    const response = errorResponse(error, "Invalid create transaction request");
    return res.status(response.statusCode).json(response.body);
  }
});

transactionLifecycleRouter.post("/api/v1/transactions/:claimId/fund", requireAuth, async (req, res) => {
  try {
    const payload = fundTransactionSchema.parse(req.body);
    const updated = await transactionLifecycleService.fund(req.params.claimId, payload, getAuthenticatedUserId(req));
    return res.json({ data: updated });
  } catch (error) {
    const response = errorResponse(error, "Invalid fund request");
    return res.status(response.statusCode).json(response.body);
  }
});

transactionLifecycleRouter.post("/api/v1/transactions/:claimId/transfer", requireAuth, async (req, res) => {
  try {
    const payload = transferTransactionSchema.parse(req.body);
    const updated = await transactionLifecycleService.transfer(req.params.claimId, payload, getAuthenticatedUserId(req));
    return res.json({ data: updated });
  } catch (error) {
    const response = errorResponse(error, "Invalid transfer request");
    return res.status(response.statusCode).json(response.body);
  }
});

transactionLifecycleRouter.post("/api/v1/transactions/:claimId/settle", requireAuth, async (req, res) => {
  try {
    const payload = settleTransactionSchema.parse(req.body);
    const updated = await transactionLifecycleService.settle(req.params.claimId, payload, getAuthenticatedUserId(req));
    return res.json({ data: updated });
  } catch (error) {
    const response = errorResponse(error, "Invalid settlement request");
    return res.status(response.statusCode).json(response.body);
  }
});

transactionLifecycleRouter.get("/api/v1/transactions/:claimId", async (req, res) => {
  const transaction = await transactionLifecycleService.getByClaimId(req.params.claimId);
  if (!transaction) {
    return res.status(404).json({ error: "Transaction not found" });
  }

  return res.json({ data: transaction });
});
