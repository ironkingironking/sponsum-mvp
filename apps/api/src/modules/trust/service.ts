import { prisma } from "../../lib/prisma.js";

export const trustService = {
  async listProfiles() {
    return prisma.trustProfile.findMany({ include: { user: true }, orderBy: { reputationScore: "desc" } });
  },

  async getByUserId(userId: string) {
    return prisma.trustProfile.findUnique({ where: { userId }, include: { user: true } });
  }
};
