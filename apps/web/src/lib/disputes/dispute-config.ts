import type { DisputeCaseStatus, DisputeEscalationLevel } from "./dispute-types";

export const disputeStatusLabels: Record<DisputeCaseStatus, string> = {
  open: "Open",
  under_review: "Under Review",
  mediation: "Mediation",
  arbitration: "Arbitration",
  court: "Court",
  resolved: "Resolved"
};

export const escalationLabels: Record<DisputeEscalationLevel, string> = {
  level_1: "Level 1",
  level_2: "Level 2",
  level_3: "Level 3"
};
