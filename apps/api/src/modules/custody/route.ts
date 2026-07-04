import { Router } from "express";
import { getAuthenticatedUserId, requireAuth } from "../../lib/auth.js";
import { errorResponse } from "../../lib/http-error.js";
import { custodyService } from "./service.js";

export const custodyRouter = Router();

custodyRouter.get("/records", async (_req, res) => {
  try {
    res.json(await custodyService.listAll());
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Cannot list custody records" });
  }
});

custodyRouter.get("/:id/custody", async (req, res) => {
  try {
    res.json(await custodyService.listByClaim(req.params.id));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Cannot list claim custody records" });
  }
});

custodyRouter.post("/:id/custody", requireAuth, async (req, res) => {
  try {
    res.status(201).json(await custodyService.createForClaim(req.params.id, req.body, getAuthenticatedUserId(req)));
  } catch (error) {
    const response = errorResponse(error, "Cannot create custody record");
    res.status(response.statusCode).json(response.body);
  }
});
