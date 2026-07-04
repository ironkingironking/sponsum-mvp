import { prisma } from "../../lib/prisma.js";
import { assertCanManageClaim } from "../../lib/claim-access.js";
import { HttpError } from "../../lib/http-error.js";

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

  async createListing(payload: { claimId: string; askPrice: number; ownershipFraction?: number; transferConditions: string }, actorUserId: string) {
    await assertCanManageClaim(payload.claimId, actorUserId);

    return prisma.marketplaceListing.create({
      data: {
        claimId: payload.claimId,
        sellerId: actorUserId,
        askPrice: payload.askPrice,
        ownershipFraction: payload.ownershipFraction ?? 1,
        status: "PUBLISHED",
        transferConditions: payload.transferConditions
      }
    });
  },

  async buyListing(id: string, actorUserId: string) {
    const existing = await prisma.marketplaceListing.findUnique({ where: { id } });

    if (!existing) {
      throw new HttpError("Listing not found", 404);
    }

    if (existing.sellerId === actorUserId) {
      throw new HttpError("Seller cannot buy their own listing", 403);
    }

    if (existing.status === "FILLED" || existing.status === "CANCELLED") {
      throw new HttpError("Listing is no longer available", 409);
    }

    const listing = await prisma.marketplaceListing.update({
      where: { id },
      data: { buyerId: actorUserId, status: "FILLED" }
    });

    await prisma.eventLog.create({
      data: {
        claimId: listing.claimId,
        actorId: actorUserId,
        eventType: "marketplace_listing_bought",
        payload: { listingId: id, buyerId: actorUserId }
      }
    });

    return listing;
  }
};
