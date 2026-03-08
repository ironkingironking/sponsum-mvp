import { Router } from "express";
import { eventsService } from "./service.js";

export const eventsRouter = Router();

eventsRouter.get("/", async (_req, res) => {
  res.json(await eventsService.listGlobal());
});

eventsRouter.get("/:id/events", async (req, res) => {
  res.json(await eventsService.listByClaim(req.params.id));
});
