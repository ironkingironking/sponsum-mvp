import type { StructuredClaim } from "@/lib/claims/claim-types";

export type DisputeCaseStatus = "open" | "under_review" | "mediation" | "arbitration" | "court" | "resolved";
export type DisputeEscalationLevel = "level_1" | "level_2" | "level_3";

export type StructuredDisputeCase = {
  id: string;
  instrumentId: string;
  instrumentTitle: string;
  title: string;
  summary: string;
  status: DisputeCaseStatus;
  escalationLevel: DisputeEscalationLevel;
  claimant: string;
  respondent: string;
  owner: string;
  openedAt: string;
  responseDueAt: string;
  claims: StructuredClaim[];
};
