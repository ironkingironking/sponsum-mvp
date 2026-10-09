export type DecimalString = string;

export const RECEIVABLE_STATUSES = [
  "UNVERIFIED",
  "VERIFIED",
  "ACCEPTED",
  "PARTIALLY_DISPUTED",
  "DISPUTED",
  "OFFERED",
  "TRADE_LOCKED",
  "FINANCED",
  "TRANSFERRED",
  "PARTIALLY_PAID",
  "PAID",
  "DEFAULTED",
  "CLOSED"
] as const;
export type ReceivableStatus = (typeof RECEIVABLE_STATUSES)[number];

export const INSTRUMENT_TYPES = [
  "ORDINARY_RECEIVABLE",
  "ASSIGNED_RECEIVABLE",
  // SPO-04: bought (paid and transferred) without a written assignment contract (OR 165 Abs. 1).
  "PURCHASED_RECEIVABLE",
  "REGISTER_RIGHT",
  "ELECTRONIC_TRADE_INSTRUMENT",
  "BITCREDIT_EBILL",
  "LEGAL_BILL_OF_EXCHANGE"
] as const;
export type SponsumInstrumentType = (typeof INSTRUMENT_TYPES)[number];

export const OFFER_STATUSES = ["DRAFT", "LIVE", "WITHDRAWN", "TRADED", "EXPIRED"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const BID_STATUSES = ["OPEN", "COUNTERED", "WITHDRAWN", "ACCEPTED", "LAPSED"] as const;
export type BidStatus = (typeof BID_STATUSES)[number];

export const TRADE_STATUSES = [
  "CREATED",
  "INSTRUCTION_ISSUED",
  "SETTLEMENT_PENDING",
  "SETTLEMENT_CONFIRMED",
  "ASSIGNMENT_EFFECTIVE",
  "COMPLETED",
  "SETTLEMENT_FAILED",
  "DISPUTED_SETTLEMENT",
  "CANCELLED"
] as const;
export type TradeStatus = (typeof TRADE_STATUSES)[number];

export const SETTLEMENT_STATUSES = [
  "ISSUED",
  "SEEN",
  "CONFIRMED",
  "PARTIAL",
  "FAILED",
  "EXPIRED",
  "MISMATCH"
] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

export const LOCK_STATES = ["UNLOCKED", "OFFER_LOCK", "TRADE_LOCK", "ASSIGNED"] as const;
export type LockState = (typeof LOCK_STATES)[number];

export const PROTOCOL_EVENT_TYPES = [
  "RECEIVABLE_CREATED",
  "RECEIVABLE_VERIFIED",
  "OFFER_CREATED",
  "OFFER_UPDATED",
  "OFFER_WITHDRAWN",
  "REQUEST_DISCLOSURE",
  "DISCLOSURE_GRANTED",
  "DISCLOSURE_DENIED",
  "BID_CREATED",
  "BID_UPDATED",
  "BID_WITHDRAWN",
  "COUNTEROFFER",
  "BID_ACCEPTED",
  "TRADE_CREATED",
  "SETTLEMENT_INITIATED",
  "SETTLEMENT_CONFIRMED",
  "ASSIGNMENT_CREATED",
  "ASSET_TRANSFERRED",
  "WECHSEL_ACKNOWLEDGED",
  "WECHSEL_GUARANTEE_ATTACHED",
  "DOCUMENT_SIGNED",
  "DOCUMENT_ANCHORED",
  "CAPITAL_NEED_CREATED",
  "CAPITAL_INTEREST",
  "CAPITAL_NEED_CONFIRMED",
  "LENDING_APPLICATION_REQUESTED",
  "ENDORSEMENT_CREATED",
  "PAYMENT_RECEIVED",
  "PARTIAL_PAYMENT_RECEIVED",
  "DISPUTE_OPENED",
  "DISPUTE_TRACK_UPDATED",
  "DISPUTE_FORM_DRAFTED",
  "DISPUTE_BRIEFING_EXPORTED",
  "DISPUTE_CLOSED",
  "DISPUTE_ARCHIVED",
  "DISPUTE_RESOLVED",
  "DEFAULT",
  "RECOURSE_TRIGGERED",
  "MATURITY_REACHED",
  "ASSET_CLOSED"
] as const;
export type ProtocolEventType = (typeof PROTOCOL_EVENT_TYPES)[number];

export type VerificationChecks = {
  contract: boolean;
  purchase_order: boolean;
  invoice: boolean;
  invoice_electronic: boolean;
  performance_documented: boolean;
  delivery_evidence: boolean;
  acceptance: boolean;
  debtor_acknowledged: boolean;
  no_dispute: boolean;
  no_previous_assignment: boolean;
  unpaid: boolean;
  debtor_kyc: boolean;
  creditor_kyc: boolean;
  credit_info: boolean;
  historical_payments: boolean;
  payment_behavior: boolean;
  known_setoffs: boolean;
  credit_notes: boolean;
  document_integrity: boolean;
};

export type ReceivableAsset = {
  receivable_id: string;
  schema_version: string;
  origin: string;
  origin_tenant_id: string;
  origin_instance_id: string;
  parent_receivable_id: string | null;
  transfer_type: string;
  instrument_type: SponsumInstrumentType;
  status: ReceivableStatus;
  currency: string;
  nominal_amount: DecimalString;
  accepted_amount: DecimalString;
  disputed_amount: DecimalString;
  outstanding_amount: DecimalString;
  issue_date: string;
  maturity_date: string;
  creditor_party_id: string;
  debtor_party_id: string;
  current_holder_party_id: string;
  invoice_id: string;
  /** ERPNext Sales Invoice this receivable is derived from; amounts and due date then come from ERPNext. */
  sales_invoice?: string | null;
  content_hash: string;
  verification_score: number;
  risk_class: string;
  resolve_case_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AssetLock = {
  receivable_id: string;
  state: LockState;
  offer_id: string | null;
  trade_id: string | null;
  version: number;
};

export type AssignmentRegistryRow = {
  id: string;
  receivable_id: string;
  public_claim_hash: string;
  transferor_party_id: string;
  transferee_party_id: string | null;
  status: "RESERVED" | "ACTIVE" | "RELEASED" | "SUPERSEDED";
};

export type VerificationSnapshot = {
  id: string;
  receivable_id: string;
  score: number;
  checks: VerificationChecks;
  computed_at: string;
};

export type Offer = {
  offer_id: string;
  receivable_id: string;
  seller_party_id: string;
  kind: "LISTING" | "RFQ" | "PRIVATE" | "WHITELIST";
  pricing_mode: "MIN_PRICE" | "ASK" | "RFQ";
  min_price: DecimalString | null;
  ask_price: DecimalString | null;
  factoring_mode: "TRUE_SALE" | "WITH_RECOURSE" | "WITHOUT_RECOURSE";
  notice_mode: "SILENT" | "OPEN";
  expires_at: string;
  status: OfferStatus;
};

export type Bid = {
  bid_id: string;
  offer_id: string;
  buyer_party_id: string;
  amount: DecimalString;
  valid_until: string;
  status: BidStatus;
};

export type Trade = {
  trade_id: string;
  offer_id: string;
  bid_id: string;
  receivable_id: string;
  seller_party_id: string;
  buyer_party_id: string;
  nominal_amount: DecimalString;
  purchase_price: DecimalString;
  currency: string;
  status: TradeStatus;
};

export type SettlementInstruction = {
  instruction_id: string;
  trade_id: string;
  provider: string;
  payer_party_id: string;
  payee_party_id: string;
  amount: DecimalString;
  currency: string;
  payee_iban: string;
  payment_reference: string;
  expires_at: string;
  status: SettlementStatus;
  /** Suite user who accepted the bid and issued the instruction; a manual confirmation needs a second person. */
  issued_by?: string | null;
};

export type SettlementObservation = {
  observation_id: string;
  instruction_id: string;
  provider: string;
  provider_event_id: string;
  observed_amount: DecimalString;
  observed_currency: string;
  observed_at: string;
};

export type ProtocolEvent = {
  event_id: string;
  event_type: ProtocolEventType;
  schema_version: string;
  receivable_id: string | null;
  offer_id: string | null;
  trade_id: string | null;
  actor_party_id: string | null;
  payload: Record<string, unknown>;
  payload_hash: string;
  prev_event_hash: string | null;
  event_hash: string;
  signature: string | null;
  created_at: string;
};

export type DisclosureGrant = {
  grant_id: string;
  offer_id: string;
  buyer_party_id: string;
  level: 0 | 1 | 2;
  payload_hash: string;
  granted_by: string;
  granted_at: string;
};

export type AccountingProposal = {
  proposal_id: string;
  event_id: string;
  receivable_id: string;
  standard: string;
  lines: Array<{ account: string; debit: DecimalString; credit: DecimalString; memo: string }>;
  status: "PROPOSED" | "POSTED" | "REJECTED";
};

export type PartyKyc = {
  party_id: string;
  status: "NONE" | "PENDING" | "PASSED" | "FAILED" | "EXPIRED";
};

export type PolicyDecision = "ALLOW" | "DENY" | "FLAG";

export type JurisdictionFeatures = {
  ordinary_assignment: PolicyDecision;
  silent_factoring: PolicyDecision;
  open_factoring: PolicyDecision;
  marketplace_p2p: PolicyDecision;
  factor_rfq: PolicyDecision;
  auto_buy: PolicyDecision;
  fractional_tokens: PolicyDecision;
  sponsum_holds_funds: PolicyDecision;
  register_rights: PolicyDecision;
  legal_bill_of_exchange: PolicyDecision;
  bitcredit: PolicyDecision;
  endorsement_recourse: PolicyDecision;
  aval_as_wechselaval: PolicyDecision;
};
