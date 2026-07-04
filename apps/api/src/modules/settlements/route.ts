import { Router } from "express";
import { getAuthenticatedUserId, requireAuth } from "../../lib/auth.js";
import { errorResponse } from "../../lib/http-error.js";
import { settlementsService } from "./service.js";

export const settlementsRouter = Router();

settlementsRouter.get("/:id/settlements", async (req, res) => {
  try {
    res.json(await settlementsService.listByClaim(req.params.id));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Cannot list claim settlements" });
  }
});

settlementsRouter.post("/:id/settlements", requireAuth, async (req, res) => {
  try {
    res.status(201).json(await settlementsService.addEvent(req.params.id, req.body, getAuthenticatedUserId(req)));
  } catch (error) {
    const response = errorResponse(error, "Cannot add settlement event");
    res.status(response.statusCode).json(response.body);
  }
});
