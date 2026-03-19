import { ClaimStatus } from "@sponsum/shared";
import { prisma } from "../../lib/prisma.js";
import type {
  CreateTransactionInput,
  FundTransactionInput,
  SettleTransactionInput,
  TransferTransactionInput
} from "./schemas.js";
import { allowedLifecycleTransitions } from "./schemas.js";

type TransactionView = {
  claimId: string;
  status: ClaimStatus;
  amount: number;
  currency: string;
  parties: Array<{ role: string; displayName: string; userId: string | null }>;
  listings: Array<{ id: string; status: string; sellerId: string; buyerId: string | null; ownershipFraction: number }>;
  settlementEvents: Array<{ id: string; type: string; status: string; amountDue: number | null; amountPaid: number | null; createdAt: Date }>;
};

function assertTransition(current: ClaimStatus, next: ClaimStatus): void {
  const allowed = allowedLifecycleTransitions[current] ?? [];
  if (!allowed.includes(next)) {
    throw new Error(`Invalid transaction lifecycle transition: ${current} -> ${next}`);
  }
}

function toNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (typeof value === "number") return value;
  if (value === null || value === undefined) return 0;
  return value.toNumber();
}

export const transactionLifecycleService = {
  async create(payload: CreateTransactionInput, actorUserId: string) {
    const claim = await prisma.$transaction(async (tx) => {
      const created = await tx.claim.create({
        data: {
          title: payload.title,
          instrumentType: payload.instrumentType,
          status: "ISSUED",
          amount: payload.amount,
          currency: payload.currency.toUpperCase(),
          issueDate: payload.issueDate,
          maturityDate: payload.maturityDate,
          settlementModel: payload.settlementModel,
          transferability: payload.transferability,
          governingLaw: payload.governingLaw,
          jurisdiction: payload.jurisdiction,
          humanSummary: payload.summary,
          disputeConfig: "direct negotiation -> mediation -> arbitration",
          createdById: actorUserId,
          issuerId: actorUserId,
          guarantors: payload.guarantorRequired ? "required" : null,
          collateralLinks: payload.collateralRequired ? "required" : null,
          escrowLinks: payload.escrowRequired ? "required" : null,
          parties: {
            create: payload.parties.map((party) => ({
              role: party.role,
              userId: party.userId,
              displayName: party.displayName
            }))
          },
          eventLogs: {
            create: {
              actorId: actorUserId,
              eventType: "transaction_created",
              payload: {
                lifecycleState: "ISSUED",
                collateralRequired: payload.collateralRequired,
                guarantorRequired: payload.guarantorRequired,
                escrowRequired: payload.escrowRequired
              }
            }
          }
        },
        include: {
          parties: true
        }
      });

      return created;
    });

    return claim;
  },

  async fund(claimId: string, payload: FundTransactionInput, actorUserId: string) {
    return prisma.$transaction(async (tx) => {
      const claim = await tx.claim.findUnique({ where: { id: claimId } });

      if (!claim) {
        throw new Error("Claim not found");
      }

      assertTransition(claim.status as ClaimStatus, ClaimStatus.ACCEPTED);

      const fundedClaim = await tx.claim.update({
        where: { id: claimId },
        data: {
          status: "ACCEPTED",
          eventLogs: {
            create: {
              actorId: actorUserId,
              eventType: "transaction_funded",
              payload: {
                source: payload.source,
                amountFunded: payload.amountFunded,
                note: payload.note ?? null,
                lifecycleState: "ACCEPTED"
              }
            }
          }
        }
      });

      if (payload.source === "escrow") {
        await tx.escrowArrangement.create({
          data: {
            relatedClaimId: claimId,
            escrowAgent: "platform-default",
            assetType: "currency",
            amount: payload.amountFunded,
            currency: claim.currency,
            releaseConditions: "release on transfer acceptance",
            status: "FUNDED"
          }
        });
      }

      return fundedClaim;
    });
  },

  async transfer(claimId: string, payload: TransferTransactionInput, actorUserId: string) {
    return prisma.$transaction(async (tx) => {
      const claim = await tx.claim.findUnique({ where: { id: claimId } });

      if (!claim) {
        throw new Error("Claim not found");
      }

      assertTransition(claim.status as ClaimStatus, ClaimStatus.ACTIVE);

      const listing = await tx.marketplaceListing.create({
        data: {
          claimId,
          sellerId: actorUserId,
          buyerId: payload.buyerId,
          status: "FILLED",
          askPrice: toNumber(claim.amount),
          ownershipFraction: payload.ownershipFraction,
          transferConditions: payload.transferConditions
        }
      });

      const updated = await tx.claim.update({
        where: { id: claimId },
        data: {
          status: "ACTIVE",
          eventLogs: {
            create: {
              actorId: actorUserId,
              eventType: "transaction_transferred",
              payload: {
                buyerId: payload.buyerId,
                ownershipFraction: payload.ownershipFraction,
                lifecycleState: "ACTIVE"
              }
            }
          }
        }
      });

      return {
        claim: updated,
        listing
      };
    });
  },

  async settle(claimId: string, payload: SettleTransactionInput, actorUserId: string) {
    return prisma.$transaction(async (tx) => {
      const claim = await tx.claim.findUnique({ where: { id: claimId } });

      if (!claim) {
        throw new Error("Claim not found");
      }

      const claimAmount = toNumber(claim.amount);
      const targetStatus: ClaimStatus =
        payload.amountPaid >= claimAmount ? ClaimStatus.SETTLED : ClaimStatus.PARTIALLY_SETTLED;
      assertTransition(claim.status as ClaimStatus, targetStatus);

      const settlement = await tx.settlementEvent.create({
        data: {
          claimId,
          type: "PAYMENT_CONFIRMED",
          status: targetStatus,
          amountDue: claimAmount,
          amountPaid: payload.amountPaid,
          dueDate: claim.maturityDate,
          confirmedAt: payload.settledAt ?? new Date(),
          note: payload.note,
          evidenceUrl: payload.evidenceUrl
        }
      });

      const updated = await tx.claim.update({
        where: { id: claimId },
        data: {
          status: targetStatus,
          eventLogs: {
            create: {
              actorId: actorUserId,
              eventType: "transaction_settled",
              payload: {
                amountPaid: payload.amountPaid,
                settlementEventId: settlement.id,
                lifecycleState: targetStatus
              }
            }
          }
        }
      });

      return {
        claim: updated,
        settlement
      };
    });
  },

  async getByClaimId(claimId: string): Promise<TransactionView | null> {
    const claim = await prisma.claim.findUnique({
      where: { id: claimId },
      include: {
        parties: true,
        listings: true,
        settlementEvents: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!claim) {
      return null;
    }

    return {
      claimId: claim.id,
      status: claim.status as ClaimStatus,
      amount: toNumber(claim.amount),
      currency: claim.currency,
      parties: claim.parties.map((party) => ({
        role: party.role,
        displayName: party.displayName,
        userId: party.userId
      })),
      listings: claim.listings.map((listing) => ({
        id: listing.id,
        status: listing.status,
        sellerId: listing.sellerId,
        buyerId: listing.buyerId,
        ownershipFraction: toNumber(listing.ownershipFraction)
      })),
      settlementEvents: claim.settlementEvents.map((event) => ({
        id: event.id,
        type: event.type,
        status: event.status,
        amountDue: event.amountDue ? toNumber(event.amountDue) : null,
        amountPaid: event.amountPaid ? toNumber(event.amountPaid) : null,
        createdAt: event.createdAt
      }))
    };
  }
};
