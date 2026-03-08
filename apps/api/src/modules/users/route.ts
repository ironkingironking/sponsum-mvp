import { Router } from "express";
import { usersService } from "./service.js";

export const usersRouter = Router();

usersRouter.get("/:id", async (req, res) => {
  const user = await usersService.getUser(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

usersRouter.get("/:id/trust-profile", async (req, res) => {
  const profile = await usersService.getTrustProfile(req.params.id);
  if (!profile) return res.status(404).json({ error: "Trust profile not found" });
  res.json(profile);
});
