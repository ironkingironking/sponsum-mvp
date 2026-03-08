import { prisma } from "../../lib/prisma.js";

export const escrowService = {
  async listAll() {
    return prisma.escrowArrangement.findMany({ orderBy: { createdAt: "desc" } });
  },

  async listByClaim(claimId: string) {
    return prisma.escrowArrangement.findMany({ where: { relatedClaimId: claimId }, orderBy: { createdAt: "desc" } });
  },

  async createForClaim(claimId: string, payload: any) {
    return prisma.escrowArrangement.create({
      data: {
        relatedClaimId: claimId,
        escrowAgent: String(payload.escrowAgent),
        assetType: String(payload.assetType),
        amount: Number(payload.amount),
        currency: String(payload.currency || "CHF"),
        releaseConditions: String(payload.releaseConditions),
        status: payload.status || "DRAFT",
        auditLog: payload.auditLog ? String(payload.auditLog) : null
      }
    });
  }
};
