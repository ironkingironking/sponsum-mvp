import type { OfferStatus, ReceivableStatus, SettlementStatus, TradeStatus } from "./receivable-types.js";

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const RECEIVABLE_TRANSITIONS: Record<ReceivableStatus, ReceivableStatus[]> = {
  UNVERIFIED: ["VERIFIED", "DISPUTED", "CLOSED"],
  VERIFIED: ["ACCEPTED", "PARTIALLY_DISPUTED", "DISPUTED", "CLOSED"],
  ACCEPTED: ["OFFERED", "PARTIALLY_DISPUTED", "DISPUTED", "PARTIALLY_PAID", "PAID", "CLOSED"],
  PARTIALLY_DISPUTED: ["ACCEPTED", "DISPUTED", "CLOSED"],
  DISPUTED: ["ACCEPTED", "PARTIALLY_DISPUTED", "CLOSED"],
  OFFERED: ["ACCEPTED", "TRADE_LOCKED", "PARTIALLY_DISPUTED", "DISPUTED", "CLOSED"],
  TRADE_LOCKED: ["TRANSFERRED", "FINANCED", "OFFERED", "ACCEPTED", "DISPUTED", "CLOSED"],
  FINANCED: ["TRANSFERRED", "PARTIALLY_PAID", "PAID", "DEFAULTED", "DISPUTED", "CLOSED"],
  TRANSFERRED: ["PARTIALLY_PAID", "PAID", "DEFAULTED", "DISPUTED", "CLOSED"],
  PARTIALLY_PAID: ["PAID", "DEFAULTED", "DISPUTED", "CLOSED"],
  PAID: ["CLOSED"],
  DEFAULTED: ["CLOSED"],
  CLOSED: []
};

export const OFFER_TRANSITIONS: Record<OfferStatus, OfferStatus[]> = {
  DRAFT: ["LIVE", "WITHDRAWN"],
  LIVE: ["WITHDRAWN", "TRADED", "EXPIRED"],
  WITHDRAWN: [],
  TRADED: [],
  EXPIRED: []
};

export const TRADE_TRANSITIONS: Record<TradeStatus, TradeStatus[]> = {
  CREATED: ["INSTRUCTION_ISSUED", "CANCELLED"],
  INSTRUCTION_ISSUED: ["SETTLEMENT_PENDING", "SETTLEMENT_FAILED", "CANCELLED"],
  SETTLEMENT_PENDING: [
    "SETTLEMENT_CONFIRMED",
    "SETTLEMENT_FAILED",
    "DISPUTED_SETTLEMENT",
    "CANCELLED"
  ],
  SETTLEMENT_CONFIRMED: ["ASSIGNMENT_EFFECTIVE"],
  ASSIGNMENT_EFFECTIVE: ["COMPLETED"],
  COMPLETED: [],
  SETTLEMENT_FAILED: ["INSTRUCTION_ISSUED", "CANCELLED"],
  DISPUTED_SETTLEMENT: ["INSTRUCTION_ISSUED", "CANCELLED"],
  CANCELLED: []
};

export const SETTLEMENT_TRANSITIONS: Record<SettlementStatus, SettlementStatus[]> = {
  ISSUED: ["SEEN", "CONFIRMED", "PARTIAL", "FAILED", "EXPIRED", "MISMATCH"],
  SEEN: ["CONFIRMED", "PARTIAL", "FAILED", "EXPIRED", "MISMATCH"],
  CONFIRMED: [],
  PARTIAL: ["CONFIRMED", "FAILED", "EXPIRED"],
  FAILED: [],
  EXPIRED: [],
  MISMATCH: []
};

export function assertTransition<T extends string>(
  map: Record<T, T[]>,
  from: T,
  to: T,
  entity: string
): void {
  if (!map[from]?.includes(to)) {
    throw new DomainError("invalid_transition", `${entity} cannot move ${from} → ${to}`);
  }
}

export function canOfferClean(status: ReceivableStatus, disputedAmount: string): boolean {
  if (status === "DISPUTED") return false;
  if (status === "PARTIALLY_DISPUTED") return false;
  if (Number(disputedAmount) > 0) return false;
  // VERIFIED (score 40–49) is not offerable: acceptBid only allows OFFERED → TRADE_LOCKED.
  return status === "ACCEPTED";
}

export function canCreateSecondLiveOffer(existingLiveOffers: number, lockState: string): boolean {
  if (existingLiveOffers > 0) return false;
  if (lockState === "OFFER_LOCK" || lockState === "TRADE_LOCK" || lockState === "ASSIGNED") {
    return false;
  }
  return true;
}
