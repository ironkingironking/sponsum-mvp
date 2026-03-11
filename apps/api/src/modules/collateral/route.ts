import { Router } from "express";
import { collateralService } from "./service.js";

export const collateralRouter = Router();

collateralRouter.get("/records", async (_req, res) => {
  try {
    res.json(await collateralService.listAll());
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Cannot list collateral records" });
  }
});

collateralRouter.get("/:id/collateral", async (req, res) => {
  try {
    res.json(await collateralService.listByClaim(req.params.id));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Cannot list claim collateral" });
  }
});

collateralRouter.post("/:id/collateral", async (req, res) => {
  try {
    res.status(201).json(await collateralService.createForClaim(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Cannot create collateral record" });
  }
});
