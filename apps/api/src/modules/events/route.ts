import { Router } from "express";
import { eventsService } from "./service.js";

export const eventsRouter = Router();

eventsRouter.get("/", async (_req, res) => {
  try {
    res.json(await eventsService.listGlobal());
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Cannot list events" });
  }
});

eventsRouter.get("/:id/events", async (req, res) => {
  try {
    res.json(await eventsService.listByClaim(req.params.id));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Cannot list claim events" });
  }
});
