import { ClaimLinkedClauseCard } from "@/components/claims/ClaimLinkedClauseCard";
import { ClaimLinkedDocumentRequirementCard } from "@/components/claims/ClaimLinkedDocumentRequirementCard";
import { ClaimLinkedSettlementCard } from "@/components/claims/ClaimLinkedSettlementCard";
import { ClaimLinkedTemplateFieldCard } from "@/components/claims/ClaimLinkedTemplateFieldCard";
import { formatCurrency, formatDateTime, severityToColor } from "@/lib/dashboard";
import type { InstrumentContext, StructuredClaim } from "@/lib/claims";
import { DisputeTargetBadge } from "./DisputeTargetBadge";

type DisputeClaimCardProps = {
  claim: StructuredClaim;
  context: InstrumentContext;
};

export function DisputeClaimCard({ claim, context }: DisputeClaimCardProps) {
  return (
    <article className="dispute-claim-card">
      <div className="dispute-claim-head">
        <div>
          <strong>{claim.title}</strong>
          <p>{claim.summary}</p>
        </div>
        <div className="dashboard-list-meta">
          <DisputeTargetBadge targetType={claim.targetType} />
          <span style={{ color: severityToColor(claim.severity), fontWeight: 700 }}>{claim.severity}</span>
          <span>{claim.status}</span>
        </div>
      </div>

      <div className="dispute-claim-row">
        <span>
          <strong>Kategorie:</strong> {claim.category}
        </span>
        <span>
          <strong>Typ:</strong> {claim.claimType}
        </span>
        {claim.amountInDispute !== undefined ? (
          <span>
            <strong>Streitwert:</strong> {formatCurrency(claim.amountInDispute, claim.currency || "CHF")}
          </span>
        ) : null}
        {claim.requestedDeadline ? (
          <span>
            <strong>Frist:</strong> {formatDateTime(claim.requestedDeadline)}
          </span>
        ) : null}
      </div>

      <p className="dispute-claim-statement">
        <strong>Statement:</strong> {claim.statementByClaimant}
      </p>

      <div className="claim-expected-actual">
        <div>
          <strong>Soll</strong>
          <pre>{JSON.stringify(claim.expectedValue ?? "k. A.", null, 2)}</pre>
        </div>
        <div>
          <strong>Ist</strong>
          <pre>{JSON.stringify(claim.actualValue ?? "k. A.", null, 2)}</pre>
        </div>
      </div>

      <div className="dispute-claim-row">
        <span>
          <strong>Evidence:</strong> {claim.evidenceTypes.join(", ") || "keine"}
        </span>
        <span>
          <strong>Remedy:</strong> {claim.requestedRemedy.join(", ") || "keine"}
        </span>
      </div>

      <div className="dispute-linked-grid">
        <ClaimLinkedTemplateFieldCard
          context={context}
          fieldId={claim.targetTemplateFieldId}
          expectedValue={claim.expectedValue}
          actualValue={claim.actualValue}
        />
        <ClaimLinkedClauseCard context={context} clauseId={claim.targetClauseBlockId} />
        <ClaimLinkedSettlementCard context={context} settlementEventId={claim.targetSettlementEventId} />
        <ClaimLinkedDocumentRequirementCard
          context={context}
          requirementInstanceId={claim.targetDocumentRequirementId}
          documentId={claim.targetDocumentId}
        />
      </div>
    </article>
  );
}
