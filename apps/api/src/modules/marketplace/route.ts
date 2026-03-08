import { Router } from "express";
import { marketplaceService } from "./service.js";

export const marketplaceRouter = Router();

marketplaceRouter.get("/listings", async (_req, res) => {
  res.json(await marketplaceService.listListings());
});

marketplaceRouter.post("/listings", async (req, res) => {
  try {
    const payload = {
      claimId: String(req.body.claimId),
      sellerId: String(req.body.sellerId),
      askPrice: Number(req.body.askPrice),
      ownershipFraction: req.body.ownershipFraction ? Number(req.body.ownershipFraction) : undefined,
      transferConditions: String(req.body.transferConditions || "standard transfer conditions")
    };
    res.status(201).json(await marketplaceService.createListing(payload));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Cannot create listing" });
  }
});

marketplaceRouter.post("/listings/:id/buy", async (req, res) => {
  try {
    const buyerId = String(req.body.buyerId || "");
    if (!buyerId) return res.status(400).json({ error: "buyerId required" });
    res.json(await marketplaceService.buyListing(req.params.id, buyerId));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Cannot buy listing" });
  }
});
