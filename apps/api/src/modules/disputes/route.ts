import { Router } from "express";
import { disputesService } from "./service.js";

export const disputesRouter = Router();

disputesRouter.get("/", async (_req, res) => {
  try {
    res.json(await disputesService.list());
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Cannot list disputes" });
  }
});

disputesRouter.post("/", async (req, res) => {
  try {
    res.status(201).json(await disputesService.create(req.body));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Cannot create dispute" });
  }
});

disputesRouter.get("/:id", async (req, res) => {
  try {
    const dispute = await disputesService.getById(req.params.id);
    if (!dispute) return res.status(404).json({ error: "Dispute not found" });
    res.json(dispute);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Cannot fetch dispute" });
  }
});

disputesRouter.post("/:id/respond", async (req, res) => {
  try {
    res.json(await disputesService.respond(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Cannot update dispute" });
  }
});
