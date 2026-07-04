import { Router } from "express";
import { getAuthenticatedUserId, requireAuth } from "../../lib/auth.js";
import { errorResponse } from "../../lib/http-error.js";
import { disputesService } from "./service.js";

export const disputesRouter = Router();

disputesRouter.get("/", async (_req, res) => {
  try {
    res.json(await disputesService.list());
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Cannot list disputes" });
  }
});

disputesRouter.post("/", requireAuth, async (req, res) => {
  try {
    res.status(201).json(await disputesService.create(req.body, getAuthenticatedUserId(req)));
  } catch (error) {
    const response = errorResponse(error, "Cannot create dispute");
    res.status(response.statusCode).json(response.body);
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

disputesRouter.post("/:id/respond", requireAuth, async (req, res) => {
  try {
    res.json(await disputesService.respond(req.params.id, req.body, getAuthenticatedUserId(req)));
  } catch (error) {
    const response = errorResponse(error, "Cannot update dispute");
    res.status(response.statusCode).json(response.body);
  }
});
