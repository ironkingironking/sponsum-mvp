import { prisma } from "../../lib/prisma.js";

export const marketplaceService = {
  async listListings() {
    return prisma.marketplaceListing.findMany({
      include: {
        claim: true,
        seller: true,
        buyer: true
      },
      orderBy: { createdAt: "desc" }
    });
  },

  async createListing(payload: { claimId: string; sellerId: string; askPrice: number; ownershipFraction?: number; transferConditions: string }) {
    return prisma.marketplaceListing.create({
      data: {
        claimId: payload.claimId,
        sellerId: payload.sellerId,
        askPrice: payload.askPrice,
        ownershipFraction: payload.ownershipFraction ?? 1,
        status: "PUBLISHED",
        transferConditions: payload.transferConditions
      }
    });
  },

  async buyListing(id: string, buyerId: string) {
    const listing = await prisma.marketplaceListing.update({
      where: { id },
      data: { buyerId, status: "FILLED" }
    });

    await prisma.eventLog.create({
      data: {
        claimId: listing.claimId,
        actorId: buyerId,
        eventType: "marketplace_listing_bought",
        payload: { listingId: id, buyerId }
      }
    });

    return listing;
  }
};
