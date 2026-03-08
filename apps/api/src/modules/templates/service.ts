import { prisma } from "../../lib/prisma.js";

export const templatesService = {
  async list() {
    return prisma.claimTemplate.findMany({ orderBy: { title: "asc" } });
  },
  async getById(id: string) {
    return prisma.claimTemplate.findUnique({ where: { id } });
  }
};
