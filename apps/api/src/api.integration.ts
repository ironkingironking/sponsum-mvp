import assert from "node:assert/strict";
import { AddressInfo } from "node:net";
import test from "node:test";
import type { Server } from "node:http";
import type { PrismaClient } from "@prisma/client";
import type express from "express";
import { ClaimStatus, InstrumentType, SettlementModel } from "@sponsum/shared";

type JsonResponse<T> = {
  status: number;
  body: T;
};

type AuthResponse = {
  token: string;
  user: {
    id: string;
    email: string;
    fullName: string;
  };
};

type ClaimResponse = {
  id: string;
  createdById: string;
  listings?: Array<{ id: string; sellerId: string; buyerId: string | null; status: string }>;
};

type ListingResponse = {
  id: string;
  sellerId: string;
  buyerId: string | null;
  status: string;
};

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://sponsum:sponsum@localhost:5433/sponsum_integration?schema=public";
process.env.AUTH_SECRET = "integration-test-secret-with-32-chars";
process.env.CORS_ORIGIN = "http://localhost:3000";
process.env.RATE_LIMIT_MAX_REQUESTS = "1000";

let server: Server;
let baseUrl: string;
let prisma: PrismaClient;

async function request<T>(path: string, init?: RequestInit): Promise<JsonResponse<T>> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const body = (await response.json().catch(() => ({}))) as T;

  return {
    status: response.status,
    body
  };
}

async function registerUser(emailPrefix: string): Promise<AuthResponse> {
  const response = await request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: `${emailPrefix}-${Date.now()}@sponsum.test`,
      fullName: `${emailPrefix} User`,
      password: "testpass123"
    })
  });

  assert.equal(response.status, 201);
  assert.ok(response.body.token);
  return response.body;
}

async function resetDatabase() {
  await prisma.eventLog.deleteMany();
  await prisma.uploadedDocument.deleteMany();
  await prisma.custodyRecord.deleteMany();
  await prisma.escrowArrangement.deleteMany();
  await prisma.collateralRecord.deleteMany();
  await prisma.disputeCase.deleteMany();
  await prisma.settlementEvent.deleteMany();
  await prisma.marketplaceListing.deleteMany();
  await prisma.claimParty.deleteMany();
  await prisma.claim.deleteMany();
  await prisma.claimTemplate.deleteMany();
  await prisma.trustProfile.deleteMany();
  await prisma.user.deleteMany();
}

function assertSafeTestDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for integration tests");
  }

  const parsed = new URL(databaseUrl);
  const databaseName = parsed.pathname.replace(/^\//, "");
  const isLocalHost = ["localhost", "127.0.0.1"].includes(parsed.hostname);
  const isTestDatabase = /(?:test|integration)/i.test(databaseName);

  if (!isLocalHost || !isTestDatabase) {
    throw new Error(`Refusing to run destructive integration tests against database "${databaseName}" on "${parsed.hostname}"`);
  }
}

test.before(async () => {
  assertSafeTestDatabaseUrl();

  const appModule = (await import("./app.js")) as { createApp: () => express.Express };
  const prismaModule = (await import("./lib/prisma.js")) as { prisma: PrismaClient };
  prisma = prismaModule.prisma;

  await resetDatabase();
  server = appModule.createApp().listen(0);
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await resetDatabase();
  await prisma.$disconnect();
});

test("claim publishing and marketplace buying enforce authenticated ownership", async () => {
  const issuer = await registerUser("issuer");
  const investor = await registerUser("investor");

  const unauthenticatedCreate = await request<{ error: string }>("/claims", {
    method: "POST",
    body: JSON.stringify({})
  });
  assert.equal(unauthenticatedCreate.status, 401);

  const createClaim = await request<ClaimResponse>("/claims", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${issuer.token}`
    },
    body: JSON.stringify({
      title: "Integration invoice claim",
      instrumentType: InstrumentType.INVOICE_SALE,
      amount: 12000,
      currency: "CHF",
      issueDate: new Date("2026-07-04").toISOString(),
      maturityDate: new Date("2026-12-31").toISOString(),
      status: ClaimStatus.DRAFT,
      settlementModel: SettlementModel.SINGLE_MATURITY,
      governingLaw: "Swiss OR",
      jurisdiction: "Zurich",
      transferability: "Transfer allowed with platform checks",
      humanSummary: "Integration test claim for a valid marketplace flow.",
      parties: [
        { role: "issuer", userId: issuer.user.id, displayName: issuer.user.fullName },
        { role: "debtor", displayName: "Debtor AG" }
      ]
    })
  });

  assert.equal(createClaim.status, 201);
  assert.equal(createClaim.body.createdById, issuer.user.id);

  const blockedPublish = await request<{ error: string }>(`/claims/${createClaim.body.id}/publish`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${investor.token}`
    },
    body: JSON.stringify({ askPrice: 11500, isPartialAllowed: false })
  });
  assert.equal(blockedPublish.status, 403);

  const publish = await request<ClaimResponse>(`/claims/${createClaim.body.id}/publish`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${issuer.token}`
    },
    body: JSON.stringify({ askPrice: 11500, isPartialAllowed: false })
  });

  assert.equal(publish.status, 200);
  assert.equal(publish.body.listings?.length, 1);
  assert.equal(publish.body.listings?.[0]?.sellerId, issuer.user.id);

  const listingId = publish.body.listings?.[0]?.id;
  assert.ok(listingId);

  const blockedSelfBuy = await request<{ error: string }>(`/marketplace/listings/${listingId}/buy`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${issuer.token}`
    },
    body: JSON.stringify({})
  });
  assert.equal(blockedSelfBuy.status, 403);

  const buy = await request<ListingResponse>(`/marketplace/listings/${listingId}/buy`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${investor.token}`
    },
    body: JSON.stringify({})
  });

  assert.equal(buy.status, 200);
  assert.equal(buy.body.status, "FILLED");
  assert.equal(buy.body.buyerId, investor.user.id);
});
