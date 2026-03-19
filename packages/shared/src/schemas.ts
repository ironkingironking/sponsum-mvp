import { z } from "zod";
import { ClaimStatus, InstrumentType, ListingStatus, PartyRole, SettlementModel } from "./types";

export const partySchema = z.object({
  role: z.nativeEnum(PartyRole),
  userId: z.string().optional(),
  displayName: z.string().min(2)
});

export const createClaimSchema = z.object({
  title: z.string().min(3),
  instrumentType: z.nativeEnum(InstrumentType),
  amount: z.number().positive(),
  currency: z.string().length(3),
  issueDate: z.string(),
  maturityDate: z.string(),
  status: z.nativeEnum(ClaimStatus).default(ClaimStatus.DRAFT),
  settlementModel: z.nativeEnum(SettlementModel),
  governingLaw: z.string().min(2),
  jurisdiction: z.string().min(2),
  transferability: z.string().min(2),
  humanSummary: z.string().min(10),
  parties: z.array(partySchema).min(2)
});

export const publishClaimSchema = z.object({
  listingStatus: z.nativeEnum(ListingStatus).default(ListingStatus.PUBLISHED),
  askPrice: z.number().positive(),
  isPartialAllowed: z.boolean().default(false)
});

export type CreateClaimInput = z.infer<typeof createClaimSchema>;
