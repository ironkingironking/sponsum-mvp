import { prisma } from "../../lib/prisma.js";
import { z } from "zod";

const settlementPayloadSchema = z.object({
  type: z.enum([
    "PAYMENT_DUE",
    "PAYMENT_CONFIRMED",
    "PARTIAL_PAYMENT",
    "DEFAULT_TRIGGERED",
    "GUARANTOR_TRIGGERED",
    "COLLATERAL_TRIGGERED",
    "ESCROW_TRIGGERED"
  ]),
  status: z.enum([
    "DRAFT",
    "ISSUED",
    "ACCEPTED",
    "ACTIVE",
    "PARTIALLY_SETTLED",
    "SETTLED",
    "OVERDUE",
    "DEFAULTED",
    "DISPUTED",
    "IN_ENFORCEMENT",
    "RESOLVED",
    "CANCELLED"
  ]),
  amountDue: z.number().optional(),
  amountPaid: z.number().optional(),
  dueDate: z.string().optional(),
  note: z.string().optional(),
  evidenceUrl: z.string().optional(),
  claimantId: z.string().optional(),
  respondentId: z.string().optional(),
  disputeReason: z.string().optional()
});

type SettlementPayload = z.infer<typeof settlementPayloadSchema>;

export const settlementsService = {
  async listByClaim(claimId: string) {
    return prisma.settlementEvent.findMany({ where: { claimId }, orderBy: { createdAt: "asc" } });
  },

  async addEvent(claimId: string, rawPayload: unknown) {
    const payload = settlementPayloadSchema.parse(rawPayload);

    const created = await prisma.$transaction(async (tx) => {
      const settlement = await tx.settlementEvent.create({
        data: {
          claimId,
          type: payload.type,
          status: payload.status,
          amountDue: payload.amountDue,
          amountPaid: payload.amountPaid,
          dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
          note: payload.note,
          evidenceUrl: payload.evidenceUrl,
          confirmedAt: payload.type === "PAYMENT_CONFIRMED" ? new Date() : null
        }
      });

      await tx.claim.update({
        where: { id: claimId },
        data: { status: payload.status }
      });

      await tx.eventLog.create({
        data: {
          claimId,
          eventType: payload.type.toLowerCase(),
          payload
        }
      });

      if (payload.type === "DEFAULT_TRIGGERED" && payload.claimantId && payload.respondentId) {
        const dispute = await tx.disputeCase.create({
          data: {
            relatedClaimId: claimId,
            claimantId: payload.claimantId,
            respondentId: payload.respondentId,
            disputeType: "NON_PAYMENT",
            disputeReason: payload.disputeReason || "Automatic dispute opened after default event",
            status: "OPEN",
            resolutionPath: "direct negotiation -> mediation -> arbitration"
          }
        });

        await tx.claim.update({
          where: { id: claimId },
          data: { status: "DISPUTED" }
        });

        await tx.eventLog.create({
          data: {
            claimId,
            actorId: payload.claimantId,
            eventType: "dispute_opened",
            payload: { disputeId: dispute.id, source: "default_triggered" }
          }
        });
      }

      return settlement;
    });

    return created;
  }
};
