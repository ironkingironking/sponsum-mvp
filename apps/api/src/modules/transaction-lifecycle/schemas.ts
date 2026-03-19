import { z } from "zod";
import { ClaimStatus, InstrumentType } from "@sponsum/shared";

const partyRoleSchema = z.enum(["seller", "buyer", "guarantor", "issuer", "debtor", "creditor"]);

export const createTransactionSchema = z.object({
  title: z.string().min(3),
  instrumentType: z.nativeEnum(InstrumentType),
  amount: z.number().positive(),
  currency: z.string().trim().length(3),
  issueDate: z.coerce.date(),
  maturityDate: z.coerce.date(),
  governingLaw: z.string().min(2),
  jurisdiction: z.string().min(2),
  transferability: z.string().min(2),
  settlementModel: z.enum([
    "SINGLE_MATURITY",
    "INSTALLMENTS",
    "ANNUITY",
    "PROFIT_SHARE",
    "REVENUE_SHARE",
    "MILESTONE",
    "CONDITIONAL"
  ]),
  parties: z.array(
    z.object({
      role: partyRoleSchema,
      userId: z.string().min(1).optional(),
      displayName: z.string().min(2)
    })
  ).min(2),
  collateralRequired: z.boolean().default(false),
  guarantorRequired: z.boolean().default(false),
  escrowRequired: z.boolean().default(false),
  summary: z.string().min(10)
}).superRefine((payload, ctx) => {
  const roleSet = new Set(payload.parties.map((entry) => entry.role));

  if (!roleSet.has("seller") && !roleSet.has("issuer")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A transaction requires at least a seller or issuer party"
    });
  }

  if (!roleSet.has("buyer")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A transaction requires at least one buyer party"
    });
  }

  if (payload.guarantorRequired && !roleSet.has("guarantor")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "guarantorRequired=true but no guarantor party was provided"
    });
  }
});

export const fundTransactionSchema = z.object({
  source: z.enum(["bank_transfer", "escrow", "wallet"]),
  amountFunded: z.number().positive(),
  note: z.string().max(300).optional()
});

export const transferTransactionSchema = z.object({
  buyerId: z.string().min(1),
  ownershipFraction: z.number().positive().max(1).default(1),
  transferConditions: z.string().min(3)
});

export const settleTransactionSchema = z.object({
  amountPaid: z.number().positive(),
  evidenceUrl: z.string().url().optional(),
  settledAt: z.coerce.date().optional(),
  note: z.string().max(300).optional()
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type FundTransactionInput = z.infer<typeof fundTransactionSchema>;
export type TransferTransactionInput = z.infer<typeof transferTransactionSchema>;
export type SettleTransactionInput = z.infer<typeof settleTransactionSchema>;

export const allowedLifecycleTransitions: Record<ClaimStatus, ClaimStatus[]> = {
  [ClaimStatus.DRAFT]: [ClaimStatus.ISSUED, ClaimStatus.CANCELLED],
  [ClaimStatus.ISSUED]: [ClaimStatus.ACCEPTED, ClaimStatus.CANCELLED],
  [ClaimStatus.ACCEPTED]: [ClaimStatus.ACTIVE, ClaimStatus.CANCELLED],
  [ClaimStatus.ACTIVE]: [ClaimStatus.PARTIALLY_SETTLED, ClaimStatus.SETTLED, ClaimStatus.DEFAULTED, ClaimStatus.DISPUTED],
  [ClaimStatus.PARTIALLY_SETTLED]: [ClaimStatus.SETTLED, ClaimStatus.DEFAULTED, ClaimStatus.DISPUTED],
  [ClaimStatus.SETTLED]: [],
  [ClaimStatus.OVERDUE]: [ClaimStatus.SETTLED, ClaimStatus.DEFAULTED, ClaimStatus.DISPUTED],
  [ClaimStatus.DEFAULTED]: [ClaimStatus.IN_ENFORCEMENT, ClaimStatus.RESOLVED],
  [ClaimStatus.DISPUTED]: [ClaimStatus.RESOLVED, ClaimStatus.IN_ENFORCEMENT],
  [ClaimStatus.IN_ENFORCEMENT]: [ClaimStatus.RESOLVED],
  [ClaimStatus.RESOLVED]: [],
  [ClaimStatus.CANCELLED]: []
};
