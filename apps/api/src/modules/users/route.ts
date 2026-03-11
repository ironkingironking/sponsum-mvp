import { Router } from "express";
import { usersService } from "./service.js";

export const usersRouter = Router();

usersRouter.get("/:id", async (req, res) => {
  try {
    const user = await usersService.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Cannot fetch user" });
  }
});

usersRouter.get("/:id/trust-profile", async (req, res) => {
  try {
    const profile = await usersService.getTrustProfile(req.params.id);
    if (!profile) return res.status(404).json({ error: "Trust profile not found" });
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Cannot fetch user trust profile" });
  }
});
