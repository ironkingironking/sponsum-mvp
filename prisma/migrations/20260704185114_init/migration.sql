-- CreateEnum
CREATE TYPE "InstrumentType" AS ENUM ('INVOICE_SALE', 'COLLATERALIZED_BORROWING', 'BILL_OF_EXCHANGE', 'VENTURE_FINANCING', 'ANNUITY_GUELT', 'GUARANTEE_ATTACHMENT', 'MARKETPLACE_PURCHASE', 'PROMISSORY_NOTE', 'ASSIGNABLE_RECEIVABLE', 'CUSTOM_PRIVATE_LAW');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('DRAFT', 'ISSUED', 'ACCEPTED', 'ACTIVE', 'PARTIALLY_SETTLED', 'SETTLED', 'OVERDUE', 'DEFAULTED', 'DISPUTED', 'IN_ENFORCEMENT', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PRIVATE', 'FILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SettlementModel" AS ENUM ('SINGLE_MATURITY', 'INSTALLMENTS', 'ANNUITY', 'PROFIT_SHARE', 'REVENUE_SHARE', 'MILESTONE', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "SettlementEventType" AS ENUM ('PAYMENT_DUE', 'PAYMENT_CONFIRMED', 'PARTIAL_PAYMENT', 'DEFAULT_TRIGGERED', 'GUARANTOR_TRIGGERED', 'COLLATERAL_TRIGGERED', 'ESCROW_TRIGGERED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'MEDIATION', 'ARBITRATION', 'COURT', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DisputeType" AS ENUM ('NON_PAYMENT', 'DELAYED_PAYMENT', 'PARTIAL_PAYMENT', 'CONTRACT_BREACH', 'COLLATERAL_DISPUTE', 'GUARANTOR_DISPUTE', 'ESCROW_CONFLICT', 'CUSTODY_CONFLICT', 'FRAUD_ALLEGATION', 'TRANSFER_DISPUTE', 'PROFIT_SHARE_DISPUTE');

-- CreateEnum
CREATE TYPE "TrustTier" AS ENUM ('UNVERIFIED', 'BASIC_VERIFIED', 'VERIFIED', 'TRUSTED_ISSUER', 'INSTITUTIONAL_ISSUER');

-- CreateEnum
CREATE TYPE "CollateralStatus" AS ENUM ('PENDING', 'VERIFIED', 'ENFORCED', 'RELEASED');

-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('DRAFT', 'FUNDED', 'RELEASED', 'RETURNED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "CustodyStatus" AS ENUM ('DEPOSITED', 'HELD', 'RELEASED', 'DISPUTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "instrumentType" "InstrumentType" NOT NULL,
    "simpleGuidance" TEXT NOT NULL,
    "advancedSchema" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClaimTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instrumentType" "InstrumentType" NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "maturityDate" TIMESTAMP(3) NOT NULL,
    "settlementModel" "SettlementModel" NOT NULL,
    "transferability" TEXT NOT NULL,
    "guarantors" TEXT,
    "collateralLinks" TEXT,
    "escrowLinks" TEXT,
    "custodyLinks" TEXT,
    "trustLinks" TEXT,
    "disputeConfig" TEXT NOT NULL,
    "governingLaw" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "humanSummary" TEXT NOT NULL,
    "riskRating" TEXT NOT NULL DEFAULT 'MEDIUM',
    "verificationBadge" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "isPartialTradable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "issuerId" TEXT,
    "templateId" TEXT,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimParty" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "userId" TEXT,
    "role" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "rights" TEXT,
    "duties" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceListing" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT,
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "askPrice" DECIMAL(18,2) NOT NULL,
    "ownershipFraction" DECIMAL(6,4) NOT NULL DEFAULT 1,
    "transferConditions" TEXT NOT NULL,
    "privateShareToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementEvent" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "type" "SettlementEventType" NOT NULL,
    "status" "ClaimStatus" NOT NULL,
    "dueDate" TIMESTAMP(3),
    "amountDue" DECIMAL(18,2),
    "amountPaid" DECIMAL(18,2),
    "confirmedAt" TIMESTAMP(3),
    "evidenceUrl" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisputeCase" (
    "id" TEXT NOT NULL,
    "relatedClaimId" TEXT NOT NULL,
    "claimantId" TEXT NOT NULL,
    "respondentId" TEXT NOT NULL,
    "disputeType" "DisputeType" NOT NULL,
    "disputeReason" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionPath" TEXT NOT NULL,
    "evidence" TEXT,
    "mediatorId" TEXT,
    "decision" TEXT,
    "enforcementStatus" TEXT,
    "auditLog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisputeCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalClaimsIssued" INTEGER NOT NULL DEFAULT 0,
    "totalClaimsBought" INTEGER NOT NULL DEFAULT 0,
    "totalClaimsSold" INTEGER NOT NULL DEFAULT 0,
    "totalClaimsSettled" INTEGER NOT NULL DEFAULT 0,
    "defaultRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "disputeRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "repaymentReliability" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "reputationScore" INTEGER NOT NULL DEFAULT 0,
    "trustTier" "TrustTier" NOT NULL DEFAULT 'UNVERIFIED',
    "verificationBadges" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollateralRecord" (
    "id" TEXT NOT NULL,
    "relatedClaimId" TEXT NOT NULL,
    "collateralType" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "beneficiary" TEXT NOT NULL,
    "valuation" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CHF',
    "verificationStatus" TEXT NOT NULL,
    "lienRank" INTEGER NOT NULL DEFAULT 1,
    "status" "CollateralStatus" NOT NULL DEFAULT 'PENDING',
    "auditLog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollateralRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowArrangement" (
    "id" TEXT NOT NULL,
    "relatedClaimId" TEXT NOT NULL,
    "escrowAgent" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CHF',
    "releaseConditions" TEXT NOT NULL,
    "status" "EscrowStatus" NOT NULL DEFAULT 'DRAFT',
    "auditLog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowArrangement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustodyRecord" (
    "id" TEXT NOT NULL,
    "relatedClaimId" TEXT NOT NULL,
    "custodian" TEXT NOT NULL,
    "documentHash" TEXT NOT NULL,
    "custodyType" TEXT NOT NULL,
    "custodyStatus" "CustodyStatus" NOT NULL DEFAULT 'DEPOSITED',
    "auditLog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustodyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadedDocument" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "uploaderId" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "documentHash" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL,
    "claimId" TEXT,
    "actorId" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ClaimTemplate_key_key" ON "ClaimTemplate"("key");

-- CreateIndex
CREATE INDEX "Claim_status_idx" ON "Claim"("status");

-- CreateIndex
CREATE INDEX "Claim_instrumentType_idx" ON "Claim"("instrumentType");

-- CreateIndex
CREATE INDEX "Claim_jurisdiction_idx" ON "Claim"("jurisdiction");

-- CreateIndex
CREATE INDEX "ClaimParty_claimId_idx" ON "ClaimParty"("claimId");

-- CreateIndex
CREATE INDEX "MarketplaceListing_status_idx" ON "MarketplaceListing"("status");

-- CreateIndex
CREATE INDEX "MarketplaceListing_claimId_idx" ON "MarketplaceListing"("claimId");

-- CreateIndex
CREATE INDEX "SettlementEvent_claimId_idx" ON "SettlementEvent"("claimId");

-- CreateIndex
CREATE INDEX "DisputeCase_relatedClaimId_idx" ON "DisputeCase"("relatedClaimId");

-- CreateIndex
CREATE INDEX "DisputeCase_status_idx" ON "DisputeCase"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TrustProfile_userId_key" ON "TrustProfile"("userId");

-- CreateIndex
CREATE INDEX "CollateralRecord_relatedClaimId_idx" ON "CollateralRecord"("relatedClaimId");

-- CreateIndex
CREATE INDEX "EscrowArrangement_relatedClaimId_idx" ON "EscrowArrangement"("relatedClaimId");

-- CreateIndex
CREATE INDEX "CustodyRecord_relatedClaimId_idx" ON "CustodyRecord"("relatedClaimId");

-- CreateIndex
CREATE INDEX "UploadedDocument_claimId_idx" ON "UploadedDocument"("claimId");

-- CreateIndex
CREATE INDEX "EventLog_claimId_idx" ON "EventLog"("claimId");

-- CreateIndex
CREATE INDEX "EventLog_eventType_idx" ON "EventLog"("eventType");

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ClaimTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimParty" ADD CONSTRAINT "ClaimParty_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimParty" ADD CONSTRAINT "ClaimParty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementEvent" ADD CONSTRAINT "SettlementEvent_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeCase" ADD CONSTRAINT "DisputeCase_relatedClaimId_fkey" FOREIGN KEY ("relatedClaimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeCase" ADD CONSTRAINT "DisputeCase_claimantId_fkey" FOREIGN KEY ("claimantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeCase" ADD CONSTRAINT "DisputeCase_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeCase" ADD CONSTRAINT "DisputeCase_mediatorId_fkey" FOREIGN KEY ("mediatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustProfile" ADD CONSTRAINT "TrustProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollateralRecord" ADD CONSTRAINT "CollateralRecord_relatedClaimId_fkey" FOREIGN KEY ("relatedClaimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowArrangement" ADD CONSTRAINT "EscrowArrangement_relatedClaimId_fkey" FOREIGN KEY ("relatedClaimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustodyRecord" ADD CONSTRAINT "CustodyRecord_relatedClaimId_fkey" FOREIGN KEY ("relatedClaimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedDocument" ADD CONSTRAINT "UploadedDocument_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedDocument" ADD CONSTRAINT "UploadedDocument_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
