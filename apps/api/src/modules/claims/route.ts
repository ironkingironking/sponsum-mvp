import { Router } from "express";
import { claimsService } from "./service.js";
import { verifyAuthToken } from "../../lib/token.js";

export const claimsRouter = Router();

function extractBearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

claimsRouter.get("/", async (_req, res) => {
  res.json(await claimsService.list());
});

claimsRouter.post("/", async (req, res) => {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const payload = verifyAuthToken(token);

    if (!payload) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const created = await claimsService.create(req.body, payload.userId);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create claim" });
  }
});

claimsRouter.get("/:id", async (req, res) => {
  const claim = await claimsService.getById(req.params.id);
  if (!claim) return res.status(404).json({ error: "Claim not found" });
  res.json(claim);
});

claimsRouter.patch("/:id", async (req, res) => {
  try {
    res.json(await claimsService.update(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to patch claim" });
  }
});

claimsRouter.post("/:id/publish", async (req, res) => {
  try {
    res.json(await claimsService.publish(req.params.id, req.body));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to publish" });
  }
});

claimsRouter.post("/:id/transfer", async (req, res) => {
  try {
    const buyerId = String(req.body.buyerId || "");
    if (!buyerId) return res.status(400).json({ error: "buyerId is required" });
    const ownershipFraction = Number(req.body.ownershipFraction ?? 1);
    res.json(await claimsService.transfer(req.params.id, buyerId, ownershipFraction));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to transfer" });
  }
});
