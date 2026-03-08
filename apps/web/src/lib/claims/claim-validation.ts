import type { ClaimBlueprint, StructuredClaim } from "./claim-types";

export type ClaimValidationResult = {
  isValid: boolean;
  errors: string[];
};

function requireField<T>(errors: string[], value: T | undefined | null, message: string) {
  if (value === undefined || value === null || value === "") {
    errors.push(message);
  }
}

export function validateStructuredClaim(claim: StructuredClaim, blueprint?: ClaimBlueprint): ClaimValidationResult {
  const errors: string[] = [];

  requireField(errors, claim.title, "Claim-Titel ist erforderlich.");
  requireField(errors, claim.summary, "Claim-Zusammenfassung ist erforderlich.");
  requireField(errors, claim.statementByClaimant, "Claim-Statement ist erforderlich.");

  if (claim.targetType === "template_field") {
    requireField(errors, claim.targetTemplateFieldId, "targetTemplateFieldId ist für template_field erforderlich.");
  }

  if (claim.targetType === "clause_block") {
    requireField(errors, claim.targetClauseBlockId, "targetClauseBlockId ist für clause_block erforderlich.");
  }

  if (claim.targetType === "settlement_event") {
    requireField(errors, claim.targetSettlementEventId, "targetSettlementEventId ist für settlement_event erforderlich.");
  }

  if (claim.targetType === "document_requirement") {
    requireField(
      errors,
      claim.targetDocumentRequirementId,
      "targetDocumentRequirementId ist für document_requirement erforderlich."
    );
  }

  if (claim.targetType === "uploaded_document") {
    requireField(errors, claim.targetDocumentId, "targetDocumentId ist für uploaded_document erforderlich.");
  }

  if (claim.targetType === "obligation") {
    requireField(errors, claim.targetObligationKey, "targetObligationKey ist für obligation erforderlich.");
  }

  if (!claim.targetValueSnapshot) {
    errors.push("targetValueSnapshot ist für die Nachvollziehbarkeit erforderlich.");
  }

  if (blueprint?.requiresAmount && (claim.amountInDispute === undefined || claim.amountInDispute <= 0)) {
    errors.push("Dieses Claim-Blueprint erfordert amountInDispute.");
  }

  if (blueprint?.requiresClauseReference && !claim.targetClauseBlockId) {
    errors.push("Dieses Claim-Blueprint erfordert eine Klausel-Referenz.");
  }

  if (blueprint?.requiresSettlementReference && !claim.targetSettlementEventId) {
    errors.push("Dieses Claim-Blueprint erfordert eine Settlement-Event-Referenz.");
  }

  if (
    blueprint?.requiresDocumentReference &&
    !claim.targetDocumentRequirementId &&
    !claim.targetDocumentId &&
    !claim.evidenceDocumentIds?.length
  ) {
    errors.push("Dieses Claim-Blueprint erfordert eine Dokument-Referenz.");
  }

  if ((claim.claimType === "non_payment" || claim.claimType === "partial_payment") && !claim.amountInDispute) {
    errors.push("Zahlungsbezogene Claims erfordern amountInDispute.");
  }

  if (claim.status !== "draft" && (!claim.evidenceTypes || claim.evidenceTypes.length === 0)) {
    errors.push("Claims außerhalb von Draft erfordern mindestens einen Evidence-Typ.");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
