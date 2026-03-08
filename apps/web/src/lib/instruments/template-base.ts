import type {
  ClauseBlock,
  CrossFieldValidationRule,
  DisputeMeta,
  MarketplaceMeta,
  TemplateField,
  RiskMeta,
  SettlementMeta
} from "./field-types";
import type { DocumentRequirementDefinition } from "./document-requirements";
import type { InstrumentType } from "./instrument-types";
import type { TemplateGroup } from "./template-groups";

export type TemplateDefinition = {
  type: InstrumentType;
  version: string;
  title: string;
  subtitle: string;
  historicalContext: string;
  legalIntent: string;
  groups: TemplateGroup[];
  fields: TemplateField[];
  clauseBlocks: ClauseBlock[];
  validationRules: CrossFieldValidationRule[];
  documentRendering: {
    titleFieldId: string;
    partyFieldIds: string[];
    summaryFieldIds: string[];
    signatureFieldIds: string[];
  };
  marketplaceMeta: MarketplaceMeta;
  riskMeta: RiskMeta;
  settlementMeta: SettlementMeta;
  disputeMeta: DisputeMeta;
  documentRequirements?: DocumentRequirementDefinition[];
};

export type InstrumentDraft = {
  id: string;
  templateType: InstrumentType;
  values: Record<string, unknown>;
  selectedClauseIds: string[];
  clauseOverrides: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

export function makeDraftFromTemplate(template: TemplateDefinition): InstrumentDraft {
  const values: Record<string, unknown> = {};

  for (const field of template.fields) {
    if (field.defaultValue !== undefined) {
      values[field.id] = field.defaultValue;
    }
  }

  return {
    id: `draft-${template.type}-${Date.now()}`,
    templateType: template.type,
    values,
    selectedClauseIds: template.clauseBlocks.filter((clause) => clause.defaultSelected).map((clause) => clause.id),
    clauseOverrides: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}
