import { notFound } from "next/navigation";
import { Badge, Card, SectionTitle } from "@sponsum/ui";
import { ClaimLinkedClauseCard } from "@/components/claims/ClaimLinkedClauseCard";
import { ClaimLinkedDocumentRequirementCard } from "@/components/claims/ClaimLinkedDocumentRequirementCard";
import { ClaimLinkedSettlementCard } from "@/components/claims/ClaimLinkedSettlementCard";
import { ClaimLinkedTemplateFieldCard } from "@/components/claims/ClaimLinkedTemplateFieldCard";
import { ClaimTargetSummary } from "@/components/claims/ClaimTargetSummary";
import { claimMocks, deriveClaimTargetCandidates, getInstrumentContextById } from "@/lib/claims";
import { formatCurrency, formatDateTime, severityToColor } from "@/lib/dashboard";

export default function ClaimDetailPage({ params }: { params: { id: string } }) {
  const claim = claimMocks.find((entry) => entry.id === params.id);
  if (!claim) {
    notFound();
  }

  const context = getInstrumentContextById(claim.instrumentId);
  if (!context) {
    notFound();
  }

  const claimTarget = deriveClaimTargetCandidates(context).find((target) => {
    if (target.targetType !== claim.targetType) return false;
    if (claim.targetTemplateFieldId && target.templateFieldId === claim.targetTemplateFieldId) return true;
    if (claim.targetClauseBlockId && target.clauseBlockId === claim.targetClauseBlockId) return true;
    if (claim.targetSettlementEventId && target.settlementEventId === claim.targetSettlementEventId) return true;
    if (claim.targetDocumentRequirementId && target.documentRequirementId === claim.targetDocumentRequirementId) return true;
    if (claim.targetDocumentId && target.documentId === claim.targetDocumentId) return true;
    if (claim.targetObligationKey && target.obligationKey === claim.targetObligationKey) return true;
    return false;
  });

  return (
    <div className="grid" style={{ gap: 16 }}>
      <Card>
        <SectionTitle title={claim.title} subtitle={claim.summary} />

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge label={claim.status} />
          <Badge label={claim.claimType} />
          <Badge label={claim.category} />
          <Badge label={claim.targetType} />
        </div>

        <div className="dashboard-list" style={{ marginTop: 12 }}>
          <div className="dashboard-list-item">
            <div>
              <strong>Instrument</strong>
              <p>{context.title}</p>
              <p>Template: {context.template.title}</p>
            </div>
            <div className="dashboard-list-meta">
              <span style={{ color: severityToColor(claim.severity), fontWeight: 700 }}>{claim.severity}</span>
              <span>Erstellt: {formatDateTime(claim.createdAt)}</span>
            </div>
          </div>

          <div className="dashboard-list-item">
            <div>
              <strong>Statement</strong>
              <p>{claim.statementByClaimant}</p>
            </div>
          </div>

          <div className="dashboard-list-item">
            <div>
              <strong>Streitwert</strong>
              <p>
                {claim.amountInDispute !== undefined
                  ? formatCurrency(claim.amountInDispute, claim.currency || "CHF")
                  : "Kein monetärer Streitwert"}
              </p>
            </div>
            <div className="dashboard-list-meta">
              {claim.requestedDeadline ? <span>Frist: {formatDateTime(claim.requestedDeadline)}</span> : null}
              <span>Aktualisiert: {formatDateTime(claim.updatedAt)}</span>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Claim-Ziel und Soll-/Ist-Abweichung" />
        <ClaimTargetSummary target={claimTarget} />
      </Card>

      <div className="grid grid-2">
        <Card>
          <SectionTitle title="Evidence" />
          {claim.evidenceTypes.length ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {claim.evidenceTypes.map((evidence) => (
                <li key={evidence}>{evidence}</li>
              ))}
            </ul>
          ) : (
            <p className="dashboard-empty">Keine Evidence-Typen hinterlegt.</p>
          )}
        </Card>

        <Card>
          <SectionTitle title="Remedies" />
          {claim.requestedRemedy.length ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {claim.requestedRemedy.map((remedy) => (
                <li key={remedy}>{remedy}</li>
              ))}
            </ul>
          ) : (
            <p className="dashboard-empty">Keine Remedies hinterlegt.</p>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle title="Verknüpfte Instrumentbestandteile" />
        <div className="grid">
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
      </Card>

      <Card>
        <SectionTitle title="Snapshot bei Erstellung" />
        <pre style={{ margin: 0 }}>{JSON.stringify(claim.targetValueSnapshot, null, 2)}</pre>
      </Card>
    </div>
  );
}
