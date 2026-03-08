import type { SettlementEvent } from "./settlement-types";

export function isSettlementEventOverdue(event: SettlementEvent, now = new Date()): boolean {
  const dueAt = new Date(event.dueAt).getTime();
  return dueAt < now.getTime() && event.settlementStatus !== "confirmed";
}

export function settlementComplianceSummary(events: SettlementEvent[], now = new Date()) {
  let due = 0;
  let confirmed = 0;
  let partial = 0;
  let overdue = 0;
  let missingProof = 0;

  for (const event of events) {
    if (event.settlementStatus === "due") due += 1;
    if (event.settlementStatus === "confirmed") confirmed += 1;
    if (event.settlementStatus === "partial") partial += 1;
    if (isSettlementEventOverdue(event, now)) overdue += 1;
    if (!event.proofDocuments.length || event.breachFlags.includes("missing_proof")) missingProof += 1;
  }

  return {
    due,
    confirmed,
    partial,
    overdue,
    missingProof
  };
}
