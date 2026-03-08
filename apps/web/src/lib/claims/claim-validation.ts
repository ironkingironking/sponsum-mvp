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

  requireField(errors, claim.title, "Claim title is required.");
  requireField(errors, claim.summary, "Claim summary is required.");
  requireField(errors, claim.statementByClaimant, "Claim statement is required.");

  if (claim.targetType === "template_field") {
    requireField(errors, claim.targetTemplateFieldId, "targetTemplateFieldId is required for template_field claims.");
  }

  if (claim.targetType === "clause_block") {
    requireField(errors, claim.targetClauseBlockId, "targetClauseBlockId is required for clause_block claims.");
  }

  if (claim.targetType === "settlement_event") {
    requireField(errors, claim.targetSettlementEventId, "targetSettlementEventId is required for settlement_event claims.");
  }

  if (claim.targetType === "document_requirement") {
    requireField(
      errors,
      claim.targetDocumentRequirementId,
      "targetDocumentRequirementId is required for document_requirement claims."
    );
  }

  if (claim.targetType === "uploaded_document") {
    requireField(errors, claim.targetDocumentId, "targetDocumentId is required for uploaded_document claims.");
  }

  if (claim.targetType === "obligation") {
    requireField(errors, claim.targetObligationKey, "targetObligationKey is required for obligation claims.");
  }

  if (!claim.targetValueSnapshot) {
    errors.push("targetValueSnapshot is required for auditability.");
  }

  if (blueprint?.requiresAmount && (claim.amountInDispute === undefined || claim.amountInDispute <= 0)) {
    errors.push("This claim blueprint requires amountInDispute.");
  }

  if (blueprint?.requiresClauseReference && !claim.targetClauseBlockId) {
    errors.push("This claim blueprint requires a clause reference.");
  }

  if (blueprint?.requiresSettlementReference && !claim.targetSettlementEventId) {
    errors.push("This claim blueprint requires a settlement event reference.");
  }

  if (
    blueprint?.requiresDocumentReference &&
    !claim.targetDocumentRequirementId &&
    !claim.targetDocumentId &&
    !claim.evidenceDocumentIds?.length
  ) {
    errors.push("This claim blueprint requires a document reference.");
  }

  if ((claim.claimType === "non_payment" || claim.claimType === "partial_payment") && !claim.amountInDispute) {
    errors.push("Payment-related claims require amountInDispute.");
  }

  if (claim.status !== "draft" && (!claim.evidenceTypes || claim.evidenceTypes.length === 0)) {
    errors.push("Non-draft claims require at least one evidence type.");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
