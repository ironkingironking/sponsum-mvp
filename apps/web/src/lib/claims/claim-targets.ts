import type { DocumentRequirementInstance, TemplateField } from "@/lib/instruments";
import type { ClaimBlueprint, ClaimTargetCandidate, InstrumentContext, StructuredClaim } from "./claim-types";

function hasDisputeMeta(field: TemplateField): boolean {
  return Boolean(
    field.disputeRelevant ||
      field.obligationType ||
      field.breachModes?.length ||
      field.claimCategoryHints?.length ||
      field.relatedDocumentTypes?.length ||
      field.relatedSettlementEventTypes?.length
  );
}

function toClaimCategoryHints(field: TemplateField): ClaimTargetCandidate["claimCategoryHints"] {
  if (!field.claimCategoryHints?.length) {
    return undefined;
  }

  return field.claimCategoryHints
    .map((hint) => {
      if (hint === "payment_default") return "payment_default";
      if (hint === "document_non_compliance") return "document_non_compliance";
      if (hint === "warranty_dispute") return "warranty_dispute";
      if (hint === "reporting_breach") return "reporting_breach";
      if (hint === "clause_dispute") return "clause_dispute";
      return "custom";
    })
    .filter((hint, index, arr) => arr.indexOf(hint) === index);
}

function documentRequirementLabel(instance: DocumentRequirementInstance, context: InstrumentContext) {
  const definition = context.documentRequirementDefinitions.find((entry) => entry.id === instance.requirementId);
  return definition?.label || instance.requirementId;
}

export function deriveClaimTargetCandidates(context: InstrumentContext): ClaimTargetCandidate[] {
  const candidates: ClaimTargetCandidate[] = [];

  for (const field of context.template.fields) {
    if (!hasDisputeMeta(field)) {
      continue;
    }

    const expected = context.values[field.id];
    const actual = context.observedValues?.[field.id];

    candidates.push({
      id: `tf-${field.id}`,
      targetType: "template_field",
      label: field.label,
      description: field.description,
      groupKey: field.group,
      templateFieldId: field.id,
      obligationKey: field.obligationType,
      expectedValue: expected,
      actualValue: actual,
      snapshot: {
        fieldId: field.id,
        label: field.label,
        group: field.group,
        value: expected,
        helpText: field.helpText,
        obligationType: field.obligationType
      },
      severityHint: field.severityHint,
      breachModes: field.breachModes,
      claimCategoryHints: toClaimCategoryHints(field),
      suggestedEvidenceTypes: field.relatedDocumentTypes as ClaimTargetCandidate["suggestedEvidenceTypes"],
      suggestedRemedies: field.remedyTypes as ClaimTargetCandidate["suggestedRemedies"]
    });
  }

  for (const clause of context.clauses) {
    if (!clause.selected || clause.disputable === false) {
      continue;
    }

    candidates.push({
      id: `cb-${clause.id}`,
      targetType: "clause_block",
      label: clause.title,
      description: clause.text,
      clauseBlockId: clause.id,
      snapshot: {
        clauseId: clause.id,
        title: clause.title,
        effectiveText: clause.effectiveText,
        category: clause.category
      },
      claimCategoryHints: (clause.disputeCategories || []).map((entry) => {
        if (entry.includes("report")) return "reporting_breach";
        if (entry.includes("warranty")) return "warranty_dispute";
        if (entry.includes("default")) return "payment_default";
        return "clause_dispute";
      }),
      suggestedEvidenceTypes: clause.defaultEvidenceTypes as ClaimTargetCandidate["suggestedEvidenceTypes"],
      suggestedRemedies: clause.standardRemedies as ClaimTargetCandidate["suggestedRemedies"]
    });
  }

  for (const event of context.settlementEvents) {
    candidates.push({
      id: `se-${event.id}`,
      targetType: "settlement_event",
      label: `${event.eventType} (${event.obligationKey})`,
      description: `Fällig ${event.dueAt} · Status ${event.settlementStatus}`,
      settlementEventId: event.id,
      obligationKey: event.obligationKey,
      expectedValue: {
        amount: event.expectedAmount,
        currency: event.currency,
        dueAt: event.dueAt
      },
      actualValue: {
        amount: event.settledAmount,
        status: event.settlementStatus,
        channel: event.settlementChannel
      },
      snapshot: {
        settlementEventId: event.id,
        eventType: event.eventType,
        obligationKey: event.obligationKey,
        dueAt: event.dueAt,
        expectedAmount: event.expectedAmount,
        settledAmount: event.settledAmount,
        status: event.settlementStatus,
        breachFlags: event.breachFlags
      },
      claimCategoryHints: ["settlement_variance"],
      severityHint: event.breachFlags.length ? "critical" : "info",
      suggestedEvidenceTypes: ["payment_proof", "settlement_log"],
      suggestedRemedies: ["payment_order", "late_fee", "escalation"]
    });
  }

  for (const requirementInstance of context.documentRequirementInstances) {
    const label = documentRequirementLabel(requirementInstance, context);
    const definition = context.documentRequirementDefinitions.find((entry) => entry.id === requirementInstance.requirementId);

    candidates.push({
      id: `dr-${requirementInstance.id}`,
      targetType: "document_requirement",
      label,
      description: definition?.description || requirementInstance.requirementId,
      documentRequirementId: requirementInstance.id,
      requiredDocumentType: definition?.documentType,
      documentFieldId: definition?.fieldIds?.[0],
      expectedValue: definition?.documentType,
      actualValue: requirementInstance.status,
      snapshot: {
        requirementId: requirementInstance.requirementId,
        instanceId: requirementInstance.id,
        status: requirementInstance.status,
        expectedBy: requirementInstance.expectedBy
      },
      claimCategoryHints: ["document_non_compliance"],
      severityHint: requirementInstance.status === "missing" ? "critical" : "warning",
      suggestedEvidenceTypes: [definition?.documentType || "custom"] as ClaimTargetCandidate["suggestedEvidenceTypes"],
      suggestedRemedies: ["document_cure", "specific_performance"]
    });
  }

  for (const document of context.uploadedDocuments) {
    if (document.status === "verified") {
      continue;
    }

    candidates.push({
      id: `ud-${document.id}`,
      targetType: "uploaded_document",
      label: document.title,
      description: `Dokumentstatus ${document.status}`,
      documentId: document.id,
      expectedValue: "verified + readable + signed",
      actualValue: {
        status: document.status,
        signed: document.signed,
        readable: document.readable
      },
      snapshot: {
        documentId: document.id,
        title: document.title,
        status: document.status,
        uploadedAt: document.uploadedAt,
        signed: document.signed,
        readable: document.readable
      },
      claimCategoryHints: ["document_non_compliance"],
      severityHint: document.status === "rejected" ? "critical" : "warning",
      suggestedEvidenceTypes: ["contract_extract", "signature_page"],
      suggestedRemedies: ["document_cure", "declaratory_relief"]
    });
  }

  for (const party of context.parties) {
    candidates.push({
      id: `party-${party.id}`,
      targetType: "instrument_party",
      label: `${party.role}: ${party.displayName}`,
      description: "Partei-/Rollenbezogene Pflichtverletzung",
      partyRole: party.role,
      snapshot: {
        partyId: party.id,
        role: party.role,
        displayName: party.displayName
      },
      claimCategoryHints: ["party_obligation"],
      suggestedEvidenceTypes: ["notice_letter"],
      suggestedRemedies: ["specific_performance", "escalation"]
    });
  }

  for (const obligation of context.obligations || []) {
    candidates.push({
      id: `obl-${obligation.key}`,
      targetType: "obligation",
      label: obligation.label,
      description: "Vertragliche Verpflichtung aus Instrumentkontext",
      obligationKey: obligation.key,
      partyRole: obligation.partyRole,
      expectedValue: obligation.expected,
      actualValue: obligation.actual,
      snapshot: obligation,
      claimCategoryHints: ["party_obligation"],
      suggestedEvidenceTypes: ["contract_extract", "notice_letter"],
      suggestedRemedies: ["specific_performance", "escalation"]
    });
  }

  return candidates;
}

export function suggestBlueprintsForTarget(
  target: ClaimTargetCandidate,
  blueprints: ClaimBlueprint[]
): ClaimBlueprint[] {
  return blueprints.filter((blueprint) => blueprint.compatibleTargetTypes.includes(target.targetType));
}

export function createTargetSnapshot(target: ClaimTargetCandidate) {
  return {
    label: target.label,
    description: target.description,
    targetType: target.targetType,
    groupKey: target.groupKey,
    expectedValue: target.expectedValue,
    actualValue: target.actualValue,
    snapshot: target.snapshot
  };
}

export function attachTargetToClaimDraft(claim: StructuredClaim, target: ClaimTargetCandidate): StructuredClaim {
  return {
    ...claim,
    targetType: target.targetType,
    targetTemplateFieldId: target.templateFieldId,
    targetClauseBlockId: target.clauseBlockId,
    targetSettlementEventId: target.settlementEventId,
    targetDocumentRequirementId: target.documentRequirementId,
    targetRequiredDocumentType: target.requiredDocumentType,
    targetDocumentFieldId: target.documentFieldId,
    targetDocumentId: target.documentId,
    targetGroupKey: target.groupKey,
    targetPartyRole: target.partyRole,
    targetObligationKey: target.obligationKey,
    targetValueSnapshot: target.snapshot || createTargetSnapshot(target),
    expectedValue: target.expectedValue,
    actualValue: target.actualValue
  };
}
