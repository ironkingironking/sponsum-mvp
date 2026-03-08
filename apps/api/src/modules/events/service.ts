import { prisma } from "../../lib/prisma.js";

export const eventsService = {
  async listGlobal(limit = 100) {
    return prisma.eventLog.findMany({ orderBy: { createdAt: "desc" }, take: limit });
  },

  async listByClaim(claimId: string) {
    return prisma.eventLog.findMany({ where: { claimId }, orderBy: { createdAt: "asc" } });
  }
};
