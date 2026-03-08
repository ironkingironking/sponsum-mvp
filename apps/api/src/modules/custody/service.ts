import { prisma } from "../../lib/prisma.js";

export const custodyService = {
  async listAll() {
    return prisma.custodyRecord.findMany({ orderBy: { createdAt: "desc" } });
  },

  async listByClaim(claimId: string) {
    return prisma.custodyRecord.findMany({ where: { relatedClaimId: claimId }, orderBy: { createdAt: "desc" } });
  },

  async createForClaim(claimId: string, payload: any) {
    return prisma.custodyRecord.create({
      data: {
        relatedClaimId: claimId,
        custodian: String(payload.custodian),
        documentHash: String(payload.documentHash),
        custodyType: String(payload.custodyType),
        custodyStatus: payload.custodyStatus || "DEPOSITED",
        auditLog: payload.auditLog ? String(payload.auditLog) : null
      }
    });
  }
};
