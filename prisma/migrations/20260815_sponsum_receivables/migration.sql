-- CreateTable
CREATE TABLE "SponsumReceivable" (
    "receivableId" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "originTenantId" TEXT NOT NULL,
    "originInstanceId" TEXT NOT NULL,
    "parentReceivableId" TEXT,
    "transferType" TEXT NOT NULL,
    "instrumentType" TEXT NOT NULL DEFAULT 'ORDINARY_RECEIVABLE',
    "status" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "nominalAmount" DECIMAL(18,2) NOT NULL,
    "acceptedAmount" DECIMAL(18,2) NOT NULL,
    "disputedAmount" DECIMAL(18,2) NOT NULL,
    "outstandingAmount" DECIMAL(18,2) NOT NULL,
    "issueDate" DATE NOT NULL,
    "maturityDate" DATE NOT NULL,
    "creditorPartyId" TEXT NOT NULL,
    "debtorPartyId" TEXT NOT NULL,
    "currentHolderPartyId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "verificationScore" INTEGER NOT NULL,
    "riskClass" TEXT NOT NULL,
    "resolveCaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SponsumReceivable_pkey" PRIMARY KEY ("receivableId")
);

CREATE UNIQUE INDEX "SponsumReceivable_originTenantId_invoiceId_key" ON "SponsumReceivable"("originTenantId", "invoiceId");
CREATE INDEX "SponsumReceivable_status_idx" ON "SponsumReceivable"("status");

CREATE TABLE "SponsumAssetLock" (
    "receivableId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "offerId" TEXT,
    "tradeId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "SponsumAssetLock_pkey" PRIMARY KEY ("receivableId")
);

CREATE TABLE "SponsumAssignmentRegistry" (
    "id" TEXT NOT NULL,
    "receivableId" TEXT NOT NULL,
    "publicClaimHash" TEXT NOT NULL,
    "transferorPartyId" TEXT NOT NULL,
    "transfereePartyId" TEXT,
    "status" TEXT NOT NULL,
    CONSTRAINT "SponsumAssignmentRegistry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SponsumAssignmentRegistry_publicClaimHash_key" ON "SponsumAssignmentRegistry"("publicClaimHash");

CREATE TABLE "SponsumProtocolEvent" (
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "receivableId" TEXT,
    "offerId" TEXT,
    "tradeId" TEXT,
    "actorPartyId" TEXT,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "prevEventHash" TEXT,
    "eventHash" TEXT NOT NULL,
    "signature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SponsumProtocolEvent_pkey" PRIMARY KEY ("eventId")
);

CREATE INDEX "SponsumProtocolEvent_receivableId_createdAt_idx" ON "SponsumProtocolEvent"("receivableId", "createdAt");
