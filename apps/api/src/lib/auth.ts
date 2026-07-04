import type { NextFunction, Request, Response } from "express";
import { verifyAuthToken } from "./token.js";

export type AuthenticatedRequest = Request & {
  userId: string;
};

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

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const payload = verifyAuthToken(token);

  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  (req as AuthenticatedRequest).userId = payload.userId;
  return next();
}

export function getAuthenticatedUserId(req: Request): string {
  const userId = (req as Partial<AuthenticatedRequest>).userId;

  if (!userId) {
    throw new Error("Authenticated user missing from request");
  }

  return userId;
}
