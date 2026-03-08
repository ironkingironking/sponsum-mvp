export const fieldTypes = [
  "text",
  "longText",
  "number",
  "currency",
  "percent",
  "date",
  "datetime",
  "select",
  "multiSelect",
  "boolean",
  "address",
  "partyReference",
  "documentUpload",
  "clauseSelector",
  "structuredObject"
] as const;

export type FieldType = (typeof fieldTypes)[number];

export type VisibilityAudience = "internal" | "counterparty" | "marketplace";
export type DisputeSeverityHint = "info" | "warning" | "critical";

export type FieldOption = {
  label: string;
  value: string;
  description?: string;
};

export type ValueComparator = "equals" | "notEquals" | "in" | "truthy" | "falsy";

export type VisibilityRule =
  | {
      kind: "field";
      fieldId: string;
      comparator: ValueComparator;
      value?: string | number | boolean | string[];
    }
  | {
      kind: "mode";
      mode: "expert" | "historical";
      enabled: boolean;
    }
  | {
      kind: "audience";
      allowed: VisibilityAudience[];
    }
  | {
      kind: "nda";
      required: boolean;
    };

export type ValidationRule =
  | { type: "required"; message?: string }
  | { type: "min"; value: number; message?: string }
  | { type: "max"; value: number; message?: string }
  | { type: "regex"; pattern: string; message?: string }
  | { type: "dependency"; fieldId: string; comparator: ValueComparator; value?: string | number | boolean; message: string };

export type CrossFieldValidationRule =
  | { type: "dateNotBefore"; fieldId: string; referenceFieldId: string; message: string }
  | { type: "numberRange"; fieldId: string; min: number; max: number; message: string }
  | {
      type: "numberNotAbove";
      fieldId: string;
      referenceFieldId: string;
      justificationFieldId?: string;
      message: string;
    }
  | {
      type: "requiredWhen";
      fieldId: string;
      dependsOnFieldId: string;
      dependsOnComparator: ValueComparator;
      dependsOnValue?: string | number | boolean;
      message: string;
    };

export type DocumentRenderingMeta = {
  documentLabel?: string;
  printable?: boolean;
  printOrder?: number;
  summaryVisible?: boolean;
  exportKey?: string;
};

export type MarketplaceMeta = {
  listingTitleField?: string;
  summaryFields: string[];
  internalOnlyFields: string[];
  ndaProtectedFields: string[];
  defaultVisibility: VisibilityAudience;
};

export type RiskMeta = {
  riskInputs: string[];
  weightings: Record<string, number>;
  scoreFormulaHint: string;
  requiresManualReviewWhen: string[];
};

export type SettlementMeta = {
  dueDateFieldIds: string[];
  amountFieldIds: string[];
  triggerFieldIds: string[];
  eventMapping: Record<string, string>;
};

export type DisputeMeta = {
  defaultDisputeType: string;
  evidenceFieldIds: string[];
  jurisdictionFieldId?: string;
  escalationPath: string[];
};

export type TemplateField = {
  id: string;
  name: string;
  label: string;
  description: string;
  helpText?: string;
  placeholder?: string;
  type: FieldType;
  required?: boolean;
  defaultValue?: unknown;
  options?: FieldOption[];
  validation?: ValidationRule[];
  visibility?: VisibilityRule[];
  historical?: boolean;
  expertOnly?: boolean;
  marketplaceVisible?: boolean;
  documentRenderable?: boolean;
  repeatable?: boolean;
  group: string;
  sortOrder: number;
  documentLabel?: string;
  printable?: boolean;
  printOrder?: number;
  summaryVisible?: boolean;
  exportKey?: string;
  disputeRelevant?: boolean;
  obligationType?: string;
  breachModes?: string[];
  requiresEvidenceIfDisputed?: boolean;
  relatedDocumentTypes?: string[];
  relatedSettlementEventTypes?: string[];
  remedyTypes?: string[];
  claimCategoryHints?: string[];
  severityHint?: DisputeSeverityHint;
  autoFlagConditions?: string[];
};

export type ClauseBlock = {
  id: string;
  title: string;
  category: "legal" | "enforcement" | "payment" | "reporting" | "historical" | "confidentiality";
  text: string;
  editable: boolean;
  historical?: boolean;
  expertOnly?: boolean;
  defaultSelected?: boolean;
  tags?: string[];
  disputable?: boolean;
  disputeCategories?: string[];
  standardRemedies?: string[];
  defaultEvidenceTypes?: string[];
  escalationHints?: string[];
};

export type VisibilityContext = {
  expertMode: boolean;
  historicalMode: boolean;
  audience: VisibilityAudience;
  ndaAccepted: boolean;
};
