import { Router } from "express";
import { trustService } from "./service.js";

export const trustRouter = Router();

trustRouter.get("/profiles", async (_req, res) => {
  try {
    res.json(await trustService.listProfiles());
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Cannot list trust profiles" });
  }
});

trustRouter.get("/:userId", async (req, res) => {
  try {
    const profile = await trustService.getByUserId(req.params.userId);
    if (!profile) return res.status(404).json({ error: "Trust profile not found" });
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Cannot fetch trust profile" });
  }
});
