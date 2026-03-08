import type {
  ClauseBlock,
  DocumentRequirementDefinition,
  DocumentRequirementInstance,
  InstrumentType,
  TemplateDefinition,
  UploadedInstrumentDocument
} from "@/lib/instruments";
import type { SettlementEvent } from "@/lib/settlement/settlement-types";

export type ClaimTargetType =
  | "template_field"
  | "clause_block"
  | "settlement_event"
  | "document_requirement"
  | "uploaded_document"
  | "obligation"
  | "payment_schedule_entry"
  | "instrument_party"
  | "custom";

export type ClaimSeverity = "info" | "warning" | "critical";
export type ClaimStatus = "draft" | "open" | "under_review" | "accepted" | "rejected" | "resolved";

export type ClaimCategory =
  | "payment_default"
  | "security_breach"
  | "document_non_compliance"
  | "settlement_variance"
  | "clause_dispute"
  | "warranty_dispute"
  | "reporting_breach"
  | "party_obligation"
  | "custom";

export type ClaimType =
  | "non_payment"
  | "late_payment"
  | "partial_payment"
  | "missing_security"
  | "missing_document"
  | "inconsistent_document"
  | "settlement_mismatch"
  | "clause_breach"
  | "warranty_breach"
  | "reporting_breach"
  | "custom";

export type ClaimRemedyType =
  | "payment_order"
  | "late_fee"
  | "specific_performance"
  | "recourse"
  | "rescission"
  | "indemnity"
  | "document_cure"
  | "declaratory_relief"
  | "penalty"
  | "escalation"
  | "interest_adjustment"
  | "termination_option"
  | "suspension"
  | "damages_claim"
  | "custom";

export type ClaimEvidenceType =
  | "payment_proof"
  | "assignment_document"
  | "origin_document"
  | "warranty_schedule"
  | "reporting_statement"
  | "contract_extract"
  | "signature_page"
  | "settlement_log"
  | "notice_letter"
  | "custom";

export type BreachDetectedFrom =
  | "manual_user_input"
  | "rule_engine"
  | "settlement_monitor"
  | "document_compliance_monitor"
  | "counterparty_report";

export type ClaimSourceContext = {
  templateType: InstrumentType;
  templateVersion: string;
  templateTitle: string;
  instrumentTitle: string;
  createdAt: string;
  actor: string;
};

export type ClaimTargetReference = {
  targetType: ClaimTargetType;
  targetTemplateFieldId?: string;
  targetClauseBlockId?: string;
  targetSettlementEventId?: string;
  targetDocumentRequirementId?: string;
  targetDocumentId?: string;
  targetGroupKey?: string;
  targetPartyRole?: string;
  targetObligationKey?: string;
  targetValueSnapshot?: unknown;
  expectedValue?: unknown;
  actualValue?: unknown;
  breachDetectedFrom?: BreachDetectedFrom;
  sourceContext?: ClaimSourceContext;
};

export type StructuredClaim = {
  id: string;
  disputeId?: string;
  instrumentId: string;
  claimType: ClaimType;
  category: ClaimCategory;
  title: string;
  summary: string;
  statementByClaimant: string;
  amountInDispute?: number;
  currency?: string;
  requestedRemedy: ClaimRemedyType[];
  status: ClaimStatus;
  severity: ClaimSeverity;
  evidenceTypes: ClaimEvidenceType[];
  evidenceDocumentIds?: string[];
  createdAt: string;
  updatedAt: string;
} & ClaimTargetReference;

export type ClaimBlueprint = {
  claimBlueprintId: string;
  instrumentType: InstrumentType;
  label: string;
  description: string;
  compatibleTargetTypes: ClaimTargetType[];
  defaultClaimType: ClaimType;
  defaultCategory: ClaimCategory;
  suggestedEvidenceTypes: ClaimEvidenceType[];
  suggestedRemedies: ClaimRemedyType[];
  severity: ClaimSeverity;
  requiresAmount: boolean;
  requiresClauseReference: boolean;
  requiresSettlementReference: boolean;
  requiresDocumentReference: boolean;
};

export type ClaimTargetCandidate = {
  id: string;
  targetType: ClaimTargetType;
  label: string;
  description: string;
  groupKey?: string;
  templateFieldId?: string;
  clauseBlockId?: string;
  settlementEventId?: string;
  documentRequirementId?: string;
  documentId?: string;
  partyRole?: string;
  obligationKey?: string;
  expectedValue?: unknown;
  actualValue?: unknown;
  snapshot?: unknown;
  severityHint?: ClaimSeverity;
  claimCategoryHints?: ClaimCategory[];
  breachModes?: string[];
  suggestedEvidenceTypes?: ClaimEvidenceType[];
  suggestedRemedies?: ClaimRemedyType[];
};

export type InstrumentParty = {
  id: string;
  role: string;
  displayName: string;
};

export type InstrumentClauseInstance = ClauseBlock & {
  selected: boolean;
  effectiveText: string;
};

export type InstrumentContext = {
  id: string;
  title: string;
  template: TemplateDefinition;
  values: Record<string, unknown>;
  observedValues?: Record<string, unknown>;
  parties: InstrumentParty[];
  clauses: InstrumentClauseInstance[];
  obligations?: Array<{ key: string; label: string; expected: unknown; actual?: unknown; partyRole?: string }>;
  settlementEvents: SettlementEvent[];
  documentRequirementDefinitions: DocumentRequirementDefinition[];
  documentRequirementInstances: DocumentRequirementInstance[];
  uploadedDocuments: UploadedInstrumentDocument[];
};
