import { Router } from "express";
import { templatesService } from "./service.js";

export const templatesRouter = Router();

templatesRouter.get("/", async (_req, res) => {
  try {
    res.json(await templatesService.list());
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Cannot list templates" });
  }
});

templatesRouter.get("/:id", async (req, res) => {
  try {
    const template = await templatesService.getById(req.params.id);
    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Cannot fetch template" });
  }
});
