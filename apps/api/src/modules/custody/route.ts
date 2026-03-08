import { Router } from "express";
import { custodyService } from "./service.js";

export const custodyRouter = Router();

custodyRouter.get("/records", async (_req, res) => {
  res.json(await custodyService.listAll());
});

custodyRouter.get("/:id/custody", async (req, res) => {
  res.json(await custodyService.listByClaim(req.params.id));
});

custodyRouter.post("/:id/custody", async (req, res) => {
  try {
    res.status(201).json(await custodyService.createForClaim(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Cannot create custody record" });
  }
});
