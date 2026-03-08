import { Router } from "express";
import { trustService } from "./service.js";

export const trustRouter = Router();

trustRouter.get("/profiles", async (_req, res) => {
  res.json(await trustService.listProfiles());
});

trustRouter.get("/:userId", async (req, res) => {
  const profile = await trustService.getByUserId(req.params.userId);
  if (!profile) return res.status(404).json({ error: "Trust profile not found" });
  res.json(profile);
});
