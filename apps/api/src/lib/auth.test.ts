import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "./auth.js";
import { createAuthToken } from "./token.js";

process.env.AUTH_SECRET = "test-secret-with-at-least-32-characters";

function createResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    }
  };

  return response as Response & typeof response;
}

test("requireAuth attaches authenticated user id and calls next", () => {
  const token = createAuthToken("user-123");
  const req = { headers: { authorization: `Bearer ${token}` } } as Request;
  const res = createResponse();
  let nextCalled = false;
  const next: NextFunction = () => {
    nextCalled = true;
  };

  requireAuth(req, res, next);

  assert.equal(nextCalled, true);
  assert.equal((req as AuthenticatedRequest).userId, "user-123");
  assert.equal(res.statusCode, 200);
});

test("requireAuth rejects missing bearer tokens", () => {
  const req = { headers: {} } as Request;
  const res = createResponse();

  requireAuth(req, res, () => assert.fail("next should not be called"));

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: "Authentication required" });
});

test("requireAuth rejects invalid bearer tokens", () => {
  const req = { headers: { authorization: "Bearer not-a-valid-token" } } as Request;
  const res = createResponse();

  requireAuth(req, res, () => assert.fail("next should not be called"));

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: "Invalid or expired token" });
});
