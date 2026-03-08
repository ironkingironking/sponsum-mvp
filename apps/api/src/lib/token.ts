import { createHmac, timingSafeEqual } from "node:crypto";

type AuthTokenPayload = {
  userId: string;
  exp: number;
};

const AUTH_DURATION_SECONDS = 60 * 60 * 24 * 7;

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4;
  const padded = pad === 0 ? normalized : normalized + "=".repeat(4 - pad);
  return Buffer.from(padded, "base64").toString();
}

function getAuthSecret(): string {
  return process.env.AUTH_SECRET || "dev-auth-secret-change-me";
}

function sign(input: string): string {
  return createHmac("sha256", getAuthSecret()).update(input).digest("base64url");
}

export function createAuthToken(userId: string): string {
  const payload: AuthTokenPayload = {
    userId,
    exp: Math.floor(Date.now() / 1000) + AUTH_DURATION_SECONDS
  };

  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encoded);

  return `${encoded}.${signature}`;
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  const [encoded, providedSignature] = token.split(".");

  if (!encoded || !providedSignature) {
    return null;
  }

  const expectedSignature = sign(encoded);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  let payload: AuthTokenPayload;

  try {
    payload = JSON.parse(base64UrlDecode(encoded)) as AuthTokenPayload;
  } catch {
    return null;
  }

  if (!payload.userId || !payload.exp) {
    return null;
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}
