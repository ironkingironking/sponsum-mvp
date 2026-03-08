import type { StructuredClaim } from "./claim-types";

export function groupClaimsByTargetType(claims: StructuredClaim[]) {
  const groups = new Map<string, number>();
  for (const claim of claims) {
    groups.set(claim.targetType, (groups.get(claim.targetType) || 0) + 1);
  }
  return Array.from(groups.entries()).map(([targetType, count]) => ({ targetType, count }));
}

export function claimsLinkedToOverdueSettlementEvents(claims: StructuredClaim[]) {
  return claims.filter((claim) => claim.targetType === "settlement_event" && claim.claimType !== "custom");
}

export function claimsByDocumentCompliance(claims: StructuredClaim[]) {
  return claims.filter(
    (claim) =>
      claim.targetType === "document_requirement" ||
      claim.targetType === "uploaded_document" ||
      claim.category === "document_non_compliance"
  );
}

export function topContestedClauseBlocks(claims: StructuredClaim[]) {
  const tally = new Map<string, number>();
  for (const claim of claims) {
    if (!claim.targetClauseBlockId) continue;
    tally.set(claim.targetClauseBlockId, (tally.get(claim.targetClauseBlockId) || 0) + 1);
  }
  return Array.from(tally.entries())
    .map(([clauseBlockId, count]) => ({ clauseBlockId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

export function topDisputedTemplateFields(claims: StructuredClaim[]) {
  const tally = new Map<string, number>();
  for (const claim of claims) {
    if (!claim.targetTemplateFieldId) continue;
    tally.set(claim.targetTemplateFieldId, (tally.get(claim.targetTemplateFieldId) || 0) + 1);
  }
  return Array.from(tally.entries())
    .map(([templateFieldId, count]) => ({ templateFieldId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

export function selectOpenClaims(claims: StructuredClaim[]) {
  return claims.filter((claim) => claim.status !== "resolved" && claim.status !== "rejected");
}

export function claimDashboardInsights(claims: StructuredClaim[]) {
  const openClaims = selectOpenClaims(claims);
  return {
    openCount: openClaims.length,
    byTargetType: groupClaimsByTargetType(openClaims),
    overdueSettlementLinked: claimsLinkedToOverdueSettlementEvents(openClaims).length,
    documentComplianceLinked: claimsByDocumentCompliance(openClaims).length,
    contestedClauses: topContestedClauseBlocks(openClaims),
    disputedFields: topDisputedTemplateFields(openClaims)
  };
}
