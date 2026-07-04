import assert from "node:assert/strict";
import test from "node:test";
import { createAuthToken, verifyAuthToken } from "./token.js";

process.env.AUTH_SECRET = "test-secret-with-at-least-32-characters";

test("auth tokens round-trip a user id", () => {
  const token = createAuthToken("user-123");
  const payload = verifyAuthToken(token);

  assert.equal(payload?.userId, "user-123");
  assert.equal(typeof payload?.exp, "number");
});

test("tampered auth tokens are rejected", () => {
  const token = createAuthToken("user-123");
  const [payload, signature] = token.split(".");
  const tamperedPayload = Buffer.from(JSON.stringify({ userId: "attacker", exp: Math.floor(Date.now() / 1000) + 60 }))
    .toString("base64url");

  assert.equal(verifyAuthToken(`${tamperedPayload}.${signature}`), null);
  assert.equal(verifyAuthToken(`${payload}.bad-signature`), null);
});
