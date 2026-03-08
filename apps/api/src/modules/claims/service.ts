import { ClaimStatus, ListingStatus, createClaimSchema, publishClaimSchema } from "@sponsum/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

export const claimsService = {
  async list() {
    return prisma.claim.findMany({
      include: { listings: true, parties: true, settlementEvents: true },
      orderBy: { createdAt: "desc" }
    });
  },

  async getById(id: string) {
    return prisma.claim.findUnique({
      where: { id },
      include: {
        parties: true,
        listings: true,
        settlementEvents: true,
        disputes: true,
        collateralRecords: true,
        escrowArrangements: true,
        custodyRecords: true,
        uploadedDocuments: true,
        eventLogs: true,
        template: true
      }
    });
  },

  async create(payload: unknown, createdById: string) {
    const data = createClaimSchema.parse(payload);

    return prisma.claim.create({
      data: {
        title: data.title,
        instrumentType: data.instrumentType,
        status: data.status,
        amount: data.amount,
        currency: data.currency,
        issueDate: new Date(data.issueDate),
        maturityDate: new Date(data.maturityDate),
        settlementModel: data.settlementModel,
        transferability: data.transferability,
        disputeConfig: "direct negotiation -> mediation -> arbitration",
        governingLaw: data.governingLaw,
        jurisdiction: data.jurisdiction,
        humanSummary: data.humanSummary,
        createdById,
        issuerId: createdById,
        parties: {
          create: data.parties.map((party: (typeof data.parties)[number]) => ({
            role: party.role,
            displayName: party.displayName,
            userId: party.userId
          }))
        },
        eventLogs: {
          create: [{ eventType: "claim_created", payload: { title: data.title } as Prisma.InputJsonValue }]
        }
      },
      include: { parties: true }
    });
  },

  async update(id: string, patch: Record<string, unknown>) {
    return prisma.claim.update({
      where: { id },
      data: {
        title: typeof patch.title === "string" ? patch.title : undefined,
        transferability: typeof patch.transferability === "string" ? patch.transferability : undefined,
        governingLaw: typeof patch.governingLaw === "string" ? patch.governingLaw : undefined,
        jurisdiction: typeof patch.jurisdiction === "string" ? patch.jurisdiction : undefined,
        humanSummary: typeof patch.humanSummary === "string" ? patch.humanSummary : undefined,
        status: typeof patch.status === "string" ? (patch.status as ClaimStatus) : undefined,
        eventLogs: {
          create: [{ eventType: "claim_updated", payload: patch as Prisma.InputJsonValue }]
        }
      }
    });
  },

  async publish(id: string, payload: unknown) {
    const data = publishClaimSchema.parse(payload);
    const claim = await prisma.claim.update({
      where: { id },
      data: {
        status: ClaimStatus.ACTIVE,
        isPartialTradable: data.isPartialAllowed,
        listings: {
          create: {
            sellerId: (payload as { sellerId: string }).sellerId,
            status: data.listingStatus as ListingStatus,
            askPrice: data.askPrice,
            transferConditions: "default transfer conditions"
          }
        },
        eventLogs: {
          create: [{ eventType: "claim_published", payload: data as Prisma.InputJsonValue }]
        }
      },
      include: { listings: true }
    });
    return claim;
  },

  async transfer(id: string, buyerId: string, ownershipFraction = 1) {
    const claim = await prisma.claim.findUnique({ where: { id } });
    if (!claim) throw new Error("Claim not found");

    await prisma.eventLog.create({
      data: {
        claimId: id,
        actorId: buyerId,
        eventType: "claim_transferred",
        payload: { buyerId, ownershipFraction }
      }
    });

    return { ok: true, claimId: id, buyerId, ownershipFraction };
  }
};
