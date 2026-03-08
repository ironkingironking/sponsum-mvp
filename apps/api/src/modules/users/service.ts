import { prisma } from "../../lib/prisma.js";

export const usersService = {
  async getUser(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, fullName: true, createdAt: true }
    });
  },

  async getTrustProfile(userId: string) {
    return prisma.trustProfile.findUnique({ where: { userId } });
  }
};
