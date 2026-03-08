import { Router } from "express";
import { settlementsService } from "./service.js";

export const settlementsRouter = Router();

settlementsRouter.get("/:id/settlements", async (req, res) => {
  res.json(await settlementsService.listByClaim(req.params.id));
});

settlementsRouter.post("/:id/settlements", async (req, res) => {
  try {
    res.status(201).json(await settlementsService.addEvent(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Cannot add settlement event" });
  }
});
