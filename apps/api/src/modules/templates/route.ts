import { Router } from "express";
import { templatesService } from "./service.js";

export const templatesRouter = Router();

templatesRouter.get("/", async (_req, res) => {
  res.json(await templatesService.list());
});

templatesRouter.get("/:id", async (req, res) => {
  const template = await templatesService.getById(req.params.id);
  if (!template) return res.status(404).json({ error: "Template not found" });
  res.json(template);
});
