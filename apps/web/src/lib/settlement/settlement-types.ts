export type SettlementStatus = "scheduled" | "due" | "partial" | "confirmed" | "overdue" | "failed";

export type SettlementEventType =
  | "payment_due"
  | "payment_received"
  | "partial_payment"
  | "default_triggered"
  | "channel_mismatch"
  | "condition_unmet";

export type SettlementEvent = {
  id: string;
  instrumentId: string;
  eventType: SettlementEventType;
  obligationKey: string;
  dueAt: string;
  expectedAmount: number;
  settledAmount: number;
  currency: string;
  settlementStatus: SettlementStatus;
  settlementChannel: "bank_transfer" | "escrow" | "custody_release";
  proofDocuments: string[];
  varianceReason?: string;
  breachFlags: Array<
    | "missing_proof"
    | "partial_payment"
    | "late_payment"
    | "wrong_currency"
    | "wrong_channel"
    | "condition_unmet"
    | "not_settled"
  >;
};
