import type {
  AccountingProposal,
  AssetLock,
  AssignmentRegistryRow,
  Bid,
  DisclosureGrant,
  Offer,
  PartyKyc,
  ProtocolEvent,
  ReceivableAsset,
  SettlementInstruction,
  SettlementObservation,
  Trade,
  VerificationSnapshot
} from "@sponsum/shared";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { normalizeWorkbench } from "./dispute-workbench.js";

export type CapitalKind = "EQUITY" | "SHORT_DEBT" | "LONG_DEBT";

export type CapitalNeed = {
  need_id: string;
  seeker_party_id: string;
  kind: CapitalKind;
  amount: string;
  currency: string;
  tenor_months: number | null;
  purpose: string;
  sector: string;
  country: string;
  /** CONFIRMED: a tenant admin linked the need to exactly one receivable; releases the Lending handover (O5). */
  status: "OPEN" | "INTRODUCED" | "CONFIRMED" | "WITHDRAWN";
  receivable_id: string | null;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  legal_note: string;
  created_at: string;
};

export type CapitalProvider = {
  provider_id: string;
  display_name: string;
  kind: "INVESTOR" | "LENDER" | "BANK" | "FAMILY_OFFICE";
  countries: string[];
  currencies: string[];
  tickets_min: string;
  tickets_max: string;
  offers: CapitalKind[];
  max_tenor_months: number | null;
  regulatory_status: string;
  public_blurb: string;
};

export type CapitalInterest = {
  interest_id: string;
  need_id: string;
  provider_id: string;
  note: string;
  status: "PROPOSED" | "INTRODUCED" | "DECLINED";
  created_at: string;
};

export type BuyerProfile = {
  party_id: string;
  country: string;
  currency: string;
  min_debtor_rating: string;
  max_maturity_days: number;
  max_single_position: string;
  min_expected_yield: number;
  sector_exclusions: string[];
};

export type SignatureRole = "DRAWER" | "DRAWEE" | "TRANSFEROR" | "TRANSFEREE" | "GUARANTOR";

export type InstrumentSignature = {
  signature_id: string;
  role: SignatureRole;
  party_id: string;
  signer_label: string;
  quality: "SES" | "AES" | "QES" | "DEMO" | "PENDING";
  method: "SUITE_CONFIRM" | "SKRIBBLE";
  status: "PENDING" | "SIGNED";
  content_hash: string;
  signature: string;
  signed_at: string;
  legal_note: string;
  signer_email?: string;
  signing_url?: string;
  skribble_request_id?: string;
};

export type DocumentAnchor = {
  anchor_id: string;
  content_hash: string;
  event_hash: string;
  method: "PROTOCOL_CHAIN";
  legal_note: string;
  created_at: string;
};

export type AssignmentPackage = {
  assignment_id: string;
  receivable_id: string;
  trade_id: string;
  transferor_party_id: string;
  transferee_party_id: string;
  debtor_party_id: string;
  nominal_amount: string;
  purchase_price: string;
  currency: string;
  factoring_mode: "TRUE_SALE" | "WITH_RECOURSE" | "WITHOUT_RECOURSE";
  notice_mode: "SILENT" | "OPEN";
  legal_basis: string;
  contract_title: string;
  payee_iban: string;
  payment_reference: string;
  status: "INSTRUCTION_ISSUED" | "EFFECTIVE";
  created_at: string;
  signatures: InstrumentSignature[];
};

export type WechselAcceptance = {
  accepted_at: string;
  drawee_party_id: string;
  legal_qualification: "COMMERCIAL_ACKNOWLEDGEMENT";
};

export type WechselGuarantee = {
  guarantee_id: string;
  guarantor_party_id: string;
  kind: "SURETY" | "GUARANTEE";
  legal_qualification: "NOT_A_WECHSELAVAL";
  amount: string;
  created_at: string;
};

export const WECHSEL_FORMS = ["GEZOGEN", "SOLA"] as const;
export type WechselForm = (typeof WECHSEL_FORMS)[number];

export const WECHSEL_PURPOSES = ["HANDELSWECHSEL", "FINANZWECHSEL"] as const;
export type WechselPurpose = (typeof WECHSEL_PURPOSES)[number];

export const WECHSEL_VERFALL = ["TAGWECHSEL", "SICHTWECHSEL", "NACHSICHTWECHSEL"] as const;
export type WechselVerfall = (typeof WECHSEL_VERFALL)[number];

export type WechselDraft = {
  instrument_id: string;
  receivable_id: string;
  legal_qualification: "NOT_A_BILL_OF_EXCHANGE";
  instrument_type: "ELECTRONIC_TRADE_INSTRUMENT";
  status: "DRAFT" | "ISSUED" | "ACKNOWLEDGED" | "SECURED" | "ASSIGNED";
  wechsel_form: WechselForm;
  wechsel_purpose: WechselPurpose;
  verfall_art: WechselVerfall;
  after_sight_days: number | null;
  drawer_party_id: string;
  drawee_party_id: string;
  remittee_party_id: string;
  amount: string;
  currency: string;
  issue_date: string;
  maturity_date: string;
  place_of_payment: string;
  disclaimer: string;
  created_at: string;
  acceptance: WechselAcceptance | null;
  guarantees: WechselGuarantee[];
  assignment_ids: string[];
  signatures: InstrumentSignature[];
  anchors: DocumentAnchor[];
};

export function parseWechselArt(input: {
  wechsel_form?: string;
  wechsel_purpose?: string;
  verfall_art?: string;
  after_sight_days?: string | number | null;
}): {
  wechsel_form: WechselForm;
  wechsel_purpose: WechselPurpose;
  verfall_art: WechselVerfall;
  after_sight_days: number | null;
} {
  const form = input.wechsel_form === "SOLA" ? "SOLA" : "GEZOGEN";
  const purpose: WechselPurpose = "HANDELSWECHSEL";
  const raw = String(input.verfall_art || "TAGWECHSEL").toUpperCase();
  const verfall: WechselVerfall =
    raw === "SICHT" || raw === "SICHTWECHSEL"
      ? "SICHTWECHSEL"
      : raw === "NACHSICHT" || raw === "NACHSICHTWECHSEL"
        ? "NACHSICHTWECHSEL"
        : "TAGWECHSEL";
  const days =
    verfall === "NACHSICHTWECHSEL" ? Math.max(1, Number(input.after_sight_days ?? 30) || 30) : null;
  return { wechsel_form: form, wechsel_purpose: purpose, verfall_art: verfall, after_sight_days: days };
}

export type FactorNode = {
  node_id: string;
  kind: "FACTOR" | "BANK" | "INSTITUTION" | "SME";
  jurisdiction: string;
  currencies: string[];
  min_invoice: string;
  max_invoice: string;
  regulatory_status: string;
  pricing_api: boolean;
};

export type SponsumState = {
  assets: ReceivableAsset[];
  locks: AssetLock[];
  registry: AssignmentRegistryRow[];
  verifications: VerificationSnapshot[];
  offers: Offer[];
  bids: Bid[];
  trades: Trade[];
  instructions: SettlementInstruction[];
  observations: SettlementObservation[];
  events: ProtocolEvent[];
  disclosures: DisclosureGrant[];
  accounting: AccountingProposal[];
  kyc: PartyKyc[];
  buyer_profiles: BuyerProfile[];
  assignments: AssignmentPackage[];
  wechsel_drafts: WechselDraft[];
  capital_needs: CapitalNeed[];
  capital_interests: CapitalInterest[];
  dispute_workbenches: import("./dispute-workbench.js").DisputeWorkbenchRecord[];
};

export function emptyState(): SponsumState {
  return {
    assets: [],
    locks: [],
    registry: [],
    verifications: [],
    offers: [],
    bids: [],
    trades: [],
    instructions: [],
    observations: [],
    events: [],
    disclosures: [],
    accounting: [],
    kyc: [],
    buyer_profiles: [],
    assignments: [],
    wechsel_drafts: [],
    capital_needs: [],
    capital_interests: [],
    dispute_workbenches: []
  };
}

function normalizeWechsel(row: Partial<WechselDraft>): WechselDraft {
  const assignmentIds = row.assignment_ids ?? [];
  const guarantees = row.guarantees ?? [];
  const acceptance = row.acceptance ?? null;
  const status =
    row.status ??
    (assignmentIds.length ? "ASSIGNED" : guarantees.length ? "SECURED" : acceptance ? "ACKNOWLEDGED" : "DRAFT");
  return {
    instrument_id: row.instrument_id ?? "",
    receivable_id: row.receivable_id ?? "",
    legal_qualification: "NOT_A_BILL_OF_EXCHANGE",
    instrument_type: "ELECTRONIC_TRADE_INSTRUMENT",
    status,
    ...parseWechselArt(row),
    drawer_party_id: row.drawer_party_id ?? "",
    drawee_party_id: row.drawee_party_id ?? "",
    remittee_party_id: row.remittee_party_id ?? "",
    amount: row.amount ?? "0.00",
    currency: row.currency ?? "CHF",
    issue_date: row.issue_date ?? "",
    maturity_date: row.maturity_date ?? "",
    place_of_payment: row.place_of_payment ?? "Zürich",
    disclaimer:
      row.disclaimer ??
      "Kein Wechsel nach Art. 990 ff. OR. Elektronischer Handelsbeleg / Zahlungsversprechen zur Zession.",
    created_at: row.created_at ?? new Date().toISOString(),
    acceptance,
    guarantees,
    assignment_ids: assignmentIds,
    signatures: (row.signatures ?? []).map(normalizeSignature),
    anchors: row.anchors ?? []
  };
}

function normalizeSignature(row: InstrumentSignature): InstrumentSignature {
  return {
    ...row,
    status: row.status ?? (row.quality === "PENDING" ? "PENDING" : "SIGNED"),
    method: row.method ?? "SUITE_CONFIRM"
  };
}

function normalizeAssignment(row: AssignmentPackage): AssignmentPackage {
  return { ...row, signatures: row.signatures ?? [] };
}

export function normalizeState(raw: Partial<SponsumState> | undefined): SponsumState {
  return {
    ...emptyState(),
    ...(raw ?? {}),
    buyer_profiles: raw?.buyer_profiles ?? [],
    assignments: (raw?.assignments ?? []).map((row) => ({
      ...normalizeAssignment(row),
      signatures: (row.signatures ?? []).map(normalizeSignature)
    })),
    wechsel_drafts: (raw?.wechsel_drafts ?? []).map(normalizeWechsel),
    capital_needs: raw?.capital_needs ?? [],
    capital_interests: raw?.capital_interests ?? [],
    dispute_workbenches: (raw?.dispute_workbenches ?? []).map((row) =>
      normalizeWorkbench(row, row.receivable_id || "")
    )
  };
}

export class MemorySponsumStore {
  constructor(private state: SponsumState = emptyState()) {}

  snapshot(): SponsumState {
    return structuredClone(normalizeState(this.state));
  }

  replace(next: SponsumState): void {
    this.state = normalizeState(next);
  }
}

export class FileSponsumStore extends MemorySponsumStore {
  constructor(private readonly filePath: string) {
    super(loadState(filePath));
  }

  override replace(next: SponsumState): void {
    super.replace(next);
    persistState(this.filePath, this.snapshot());
  }
}

function loadState(filePath: string): SponsumState {
  try {
    if (!existsSync(filePath)) return emptyState();
    return normalizeState(JSON.parse(readFileSync(filePath, "utf8")) as Partial<SponsumState>);
  } catch {
    return emptyState();
  }
}

function persistState(filePath: string, state: SponsumState): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  renameSync(tmp, filePath);
}
