import { Router } from "express";
import { getAuthenticatedUserId, requireAuth } from "../../lib/auth.js";
import { errorResponse } from "../../lib/http-error.js";
import { marketplaceService } from "./service.js";

export const marketplaceRouter = Router();

marketplaceRouter.get("/listings", async (_req, res) => {
  try {
    res.json(await marketplaceService.listListings());
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Cannot list marketplace entries" });
  }
});

marketplaceRouter.post("/listings", requireAuth, async (req, res) => {
  try {
    const payload = {
      claimId: String(req.body.claimId),
      askPrice: Number(req.body.askPrice),
      ownershipFraction: req.body.ownershipFraction ? Number(req.body.ownershipFraction) : undefined,
      transferConditions: String(req.body.transferConditions || "standard transfer conditions")
    };
    res.status(201).json(await marketplaceService.createListing(payload, getAuthenticatedUserId(req)));
  } catch (error) {
    const response = errorResponse(error, "Cannot create listing");
    res.status(response.statusCode).json(response.body);
  }
});

marketplaceRouter.post("/listings/:id/buy", requireAuth, async (req, res) => {
  try {
    res.json(await marketplaceService.buyListing(req.params.id, getAuthenticatedUserId(req)));
  } catch (error) {
    const response = errorResponse(error, "Cannot buy listing");
    res.status(response.statusCode).json(response.body);
  }
});
