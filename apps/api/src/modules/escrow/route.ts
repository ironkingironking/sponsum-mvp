import { Router } from "express";
import { getAuthenticatedUserId, requireAuth } from "../../lib/auth.js";
import { errorResponse } from "../../lib/http-error.js";
import { escrowService } from "./service.js";

export const escrowRouter = Router();

escrowRouter.get("/arrangements", async (_req, res) => {
  try {
    res.json(await escrowService.listAll());
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Cannot list escrow arrangements" });
  }
});

escrowRouter.get("/:id/escrow", async (req, res) => {
  try {
    res.json(await escrowService.listByClaim(req.params.id));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Cannot list claim escrow arrangements" });
  }
});

escrowRouter.post("/:id/escrow", requireAuth, async (req, res) => {
  try {
    res.status(201).json(await escrowService.createForClaim(req.params.id, req.body, getAuthenticatedUserId(req)));
  } catch (error) {
    const response = errorResponse(error, "Cannot create escrow arrangement");
    res.status(response.statusCode).json(response.body);
  }
});
