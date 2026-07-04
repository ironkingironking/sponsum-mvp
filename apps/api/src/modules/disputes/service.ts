import { prisma } from "../../lib/prisma.js";
import { z } from "zod";
import { assertCanActOnClaim } from "../../lib/claim-access.js";
import { HttpError } from "../../lib/http-error.js";

const createDisputeSchema = z.object({
  relatedClaimId: z.string().min(1),
  claimantId: z.string().min(1).optional(),
  respondentId: z.string().min(1),
  disputeType: z.enum([
    "NON_PAYMENT",
    "DELAYED_PAYMENT",
    "PARTIAL_PAYMENT",
    "CONTRACT_BREACH",
    "COLLATERAL_DISPUTE",
    "GUARANTOR_DISPUTE",
    "ESCROW_CONFLICT",
    "CUSTODY_CONFLICT",
    "FRAUD_ALLEGATION",
    "TRANSFER_DISPUTE",
    "PROFIT_SHARE_DISPUTE"
  ]),
  disputeReason: z.string().min(5),
  resolutionPath: z.string().min(5)
});

const respondDisputeSchema = z.object({
  status: z
    .enum(["OPEN", "UNDER_REVIEW", "MEDIATION", "ARBITRATION", "COURT", "RESOLVED", "REJECTED"])
    .optional(),
  decision: z.string().optional(),
  enforcementStatus: z.string().optional()
});

export const disputesService = {
  async list() {
    return prisma.disputeCase.findMany({
      include: { claim: true, claimant: true, respondent: true, mediator: true },
      orderBy: { createdAt: "desc" }
    });
  },

  async create(rawPayload: unknown, actorUserId: string) {
    const payload = createDisputeSchema.parse(rawPayload);
    await assertCanActOnClaim(payload.relatedClaimId, actorUserId);

    if (payload.claimantId && payload.claimantId !== actorUserId) {
      throw new HttpError("Dispute claimant must match authenticated user", 403);
    }

    const created = await prisma.$transaction(async (tx) => {
      const dispute = await tx.disputeCase.create({
        data: {
          relatedClaimId: payload.relatedClaimId,
          claimantId: actorUserId,
          respondentId: payload.respondentId,
          disputeType: payload.disputeType,
          disputeReason: payload.disputeReason,
          resolutionPath: payload.resolutionPath,
          status: "OPEN"
        }
      });

      await tx.claim.update({
        where: { id: payload.relatedClaimId },
        data: { status: "DISPUTED" }
      });

      await tx.eventLog.create({
        data: {
          claimId: payload.relatedClaimId,
          actorId: actorUserId,
          eventType: "dispute_opened",
          payload: { disputeId: dispute.id }
        }
      });

      return dispute;
    });

    return created;
  },

  async getById(id: string) {
    return prisma.disputeCase.findUnique({
      where: { id },
      include: { claim: true, claimant: true, respondent: true, mediator: true }
    });
  },

  async respond(id: string, rawPayload: unknown, actorUserId: string) {
    const payload = respondDisputeSchema.parse(rawPayload);
    const dispute = await prisma.disputeCase.findUnique({ where: { id } });
    if (!dispute) {
      throw new HttpError("Dispute not found", 404);
    }

    const canRespond =
      dispute.claimantId === actorUserId ||
      dispute.respondentId === actorUserId ||
      dispute.mediatorId === actorUserId;

    if (!canRespond) {
      throw new HttpError("You are not allowed to respond to this dispute", 403);
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.disputeCase.update({
        where: { id },
        data: {
          status: payload.status,
          decision: payload.decision,
          enforcementStatus: payload.enforcementStatus,
          auditLog: `updated:${new Date().toISOString()}`
        }
      });

      if (payload.status === "RESOLVED") {
        await tx.claim.update({
          where: { id: dispute.relatedClaimId },
          data: { status: "RESOLVED" }
        });
      }

      if (payload.status === "REJECTED") {
        await tx.claim.update({
          where: { id: dispute.relatedClaimId },
          data: { status: "ACTIVE" }
        });
      }

      await tx.eventLog.create({
        data: {
          claimId: dispute.relatedClaimId,
          actorId: actorUserId,
          eventType: payload.status === "RESOLVED" ? "dispute_resolved" : "dispute_updated",
          payload
        }
      });

      return updated;
    });
  }
};
