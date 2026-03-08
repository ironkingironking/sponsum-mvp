import { WidgetCard } from "@/components/dashboard";
import type { InstrumentContext } from "@/lib/claims";
import type { StructuredDisputeCase } from "@/lib/disputes";
import { DisputeClaimCard } from "./DisputeClaimCard";
import { DisputeTargetBadge } from "./DisputeTargetBadge";

type DisputeClaimsSectionProps = {
  dispute: StructuredDisputeCase;
  context?: InstrumentContext;
};

export function DisputeClaimsSection({ dispute, context }: DisputeClaimsSectionProps) {
  const claimsByTargetType = new Map<string, typeof dispute.claims>();

  for (const claim of dispute.claims) {
    const current = claimsByTargetType.get(claim.targetType) || [];
    claimsByTargetType.set(claim.targetType, [...current, claim]);
  }

  return (
    <WidgetCard
      title="Claims im Dispute"
      subtitle="Strukturiert nach Zieltyp mit direkter Verlinkung auf Instrumentbestandteile."
      actionHref={`/claims/${dispute.claims[0]?.id || ""}`}
      actionLabel="Claim-Detail öffnen"
    >
      {dispute.claims.length === 0 ? (
        <p className="dashboard-empty">Keine Claims im Dispute vorhanden.</p>
      ) : null}

      {Array.from(claimsByTargetType.entries()).map(([targetType, claims]) => (
        <section key={targetType} className="dispute-group-section">
          <div className="dispute-group-head">
            <DisputeTargetBadge targetType={targetType as typeof claims[number]["targetType"]} />
            <span>{claims.length} Claim(s)</span>
          </div>
          <div className="dispute-claims-list">
            {claims.map((claim) =>
              context ? (
                <DisputeClaimCard key={claim.id} claim={claim} context={context} />
              ) : (
                <article key={claim.id} className="dispute-claim-card">
                  <strong>{claim.title}</strong>
                  <p>{claim.summary}</p>
                </article>
              )
            )}
          </div>
        </section>
      ))}
    </WidgetCard>
  );
}
