import { DomainError } from "./receivable-transitions.js";
import type { JurisdictionFeatures, PolicyDecision, SponsumInstrumentType } from "./receivable-types.js";

export const CH_POLICY: JurisdictionFeatures = {
  ordinary_assignment: "ALLOW",
  silent_factoring: "ALLOW",
  open_factoring: "ALLOW",
  marketplace_p2p: "ALLOW",
  factor_rfq: "ALLOW",
  auto_buy: "DENY",
  fractional_tokens: "DENY",
  sponsum_holds_funds: "DENY",
  register_rights: "FLAG",
  legal_bill_of_exchange: "DENY",
  bitcredit: "FLAG",
  endorsement_recourse: "DENY",
  aval_as_wechselaval: "DENY"
};

export const POLICIES: Record<string, JurisdictionFeatures> = {
  CH: CH_POLICY,
  DE: { ...CH_POLICY, silent_factoring: "FLAG" },
  AT: { ...CH_POLICY },
  EU: { ...CH_POLICY, register_rights: "DENY" }
};

export function getPolicy(jurisdiction: string): JurisdictionFeatures {
  return POLICIES[jurisdiction.toUpperCase()] ?? { ...CH_POLICY, ordinary_assignment: "FLAG" };
}

export function assertAllowed(features: JurisdictionFeatures, feature: keyof JurisdictionFeatures): void {
  const decision: PolicyDecision = features[feature];
  if (decision === "DENY") {
    throw new DomainError("policy_denied", `Feature ${feature} is DENY in this jurisdiction`);
  }
}

export function assertInstrumentAllowed(jurisdiction: string, instrument: SponsumInstrumentType): void {
  const policy = getPolicy(jurisdiction);
  if (instrument === "LEGAL_BILL_OF_EXCHANGE") {
    assertAllowed(policy, "legal_bill_of_exchange");
  }
  if (instrument === "BITCREDIT_EBILL") {
    assertAllowed(policy, "bitcredit");
  }
  if (instrument === "REGISTER_RIGHT") {
    assertAllowed(policy, "register_rights");
  }
}

export function assertNoSponsumFunds(holdsFunds: boolean, jurisdiction = "CH"): void {
  if (!holdsFunds) return;
  assertAllowed(getPolicy(jurisdiction), "sponsum_holds_funds");
}

export function assertNoAutoBuy(autoBuy: boolean, jurisdiction = "CH"): void {
  if (!autoBuy) return;
  assertAllowed(getPolicy(jurisdiction), "auto_buy");
}

export function assertNoFractionalTokens(fractional: boolean, jurisdiction = "CH"): void {
  if (!fractional) return;
  assertAllowed(getPolicy(jurisdiction), "fractional_tokens");
}
