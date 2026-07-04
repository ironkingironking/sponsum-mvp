import { Router } from "express";
import { claimsService } from "./service.js";
import { getAuthenticatedUserId, requireAuth } from "../../lib/auth.js";
import { errorResponse } from "../../lib/http-error.js";

export const claimsRouter = Router();

claimsRouter.get("/", async (_req, res) => {
  try {
    res.json(await claimsService.list());
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list claims" });
  }
});

claimsRouter.post("/", requireAuth, async (req, res) => {
  try {
    const created = await claimsService.create(req.body, getAuthenticatedUserId(req));
    res.status(201).json(created);
  } catch (error) {
    const response = errorResponse(error, "Failed to create claim");
    res.status(response.statusCode).json(response.body);
  }
});

claimsRouter.get("/:id", async (req, res) => {
  try {
    const claim = await claimsService.getById(req.params.id);
    if (!claim) return res.status(404).json({ error: "Claim not found" });
    res.json(claim);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch claim" });
  }
});

claimsRouter.patch("/:id", requireAuth, async (req, res) => {
  try {
    res.json(await claimsService.update(req.params.id, req.body, getAuthenticatedUserId(req)));
  } catch (error) {
    const response = errorResponse(error, "Failed to patch claim");
    res.status(response.statusCode).json(response.body);
  }
});

claimsRouter.post("/:id/publish", requireAuth, async (req, res) => {
  try {
    res.json(await claimsService.publish(req.params.id, req.body, getAuthenticatedUserId(req)));
  } catch (error) {
    const response = errorResponse(error, "Failed to publish");
    res.status(response.statusCode).json(response.body);
  }
});

claimsRouter.post("/:id/transfer", requireAuth, async (req, res) => {
  try {
    const buyerId = String(req.body.buyerId || "");
    if (!buyerId) return res.status(400).json({ error: "buyerId is required" });
    const ownershipFraction = Number(req.body.ownershipFraction ?? 1);
    res.json(await claimsService.transfer(req.params.id, getAuthenticatedUserId(req), buyerId, ownershipFraction));
  } catch (error) {
    const response = errorResponse(error, "Failed to transfer");
    res.status(response.statusCode).json(response.body);
  }
});
