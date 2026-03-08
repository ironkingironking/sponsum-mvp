import { prisma } from "../../lib/prisma.js";

export const collateralService = {
  async listAll() {
    return prisma.collateralRecord.findMany({ orderBy: { createdAt: "desc" } });
  },

  async listByClaim(claimId: string) {
    return prisma.collateralRecord.findMany({ where: { relatedClaimId: claimId }, orderBy: { createdAt: "desc" } });
  },

  async createForClaim(claimId: string, payload: any) {
    return prisma.collateralRecord.create({
      data: {
        relatedClaimId: claimId,
        collateralType: String(payload.collateralType),
        owner: String(payload.owner),
        beneficiary: String(payload.beneficiary),
        valuation: Number(payload.valuation),
        currency: String(payload.currency || "CHF"),
        verificationStatus: String(payload.verificationStatus || "pending"),
        lienRank: Number(payload.lienRank || 1),
        status: payload.status || "PENDING",
        auditLog: payload.auditLog ? String(payload.auditLog) : null
      }
    });
  }
};
