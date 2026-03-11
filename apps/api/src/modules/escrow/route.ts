import { Router } from "express";
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

escrowRouter.post("/:id/escrow", async (req, res) => {
  try {
    res.status(201).json(await escrowService.createForClaim(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Cannot create escrow arrangement" });
  }
});
