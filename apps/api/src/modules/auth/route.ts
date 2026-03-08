import { Router } from "express";
import { z } from "zod";
import { AuthError, authService } from "./service.js";

export const authRouter = Router();

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

authRouter.post("/register", async (req, res) => {
  try {
    const body = z
      .object({
        email: z.string().email(),
        fullName: z.string().min(2),
        password: z.string().min(8)
      })
      .parse(req.body);

    const result = await authService.register(body.email, body.fullName, body.password);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request body", issues: error.issues });
    }

    return res.status(500).json({ error: "Registration failed" });
  }
});

authRouter.post("/login", async (req, res) => {
  try {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(8)
      })
      .parse(req.body);

    const result = await authService.login(body.email, body.password);
    res.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request body", issues: error.issues });
    }

    return res.status(500).json({ error: "Login failed" });
  }
});

authRouter.get("/me", async (req, res) => {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({ error: "Missing bearer token" });
    }

    const user = await authService.me(token);

    if (!user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    return res.json({ user });
  } catch {
    return res.status(500).json({ error: "Unable to fetch profile" });
  }
});
