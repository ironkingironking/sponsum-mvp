import type { InstrumentContext } from "@/lib/claims";

type ClaimLinkedClauseCardProps = {
  context: InstrumentContext;
  clauseId?: string;
};

export function ClaimLinkedClauseCard({ context, clauseId }: ClaimLinkedClauseCardProps) {
  if (!clauseId) {
    return null;
  }

  const clause = context.clauses.find((entry) => entry.id === clauseId);
  if (!clause) {
    return null;
  }

  return (
    <div className="claim-link-card">
      <strong>Klauselblock</strong>
      <p>
        {clause.title} ({clause.id})
      </p>
      <p>{clause.effectiveText}</p>
      {clause.disputeCategories?.length ? <p>Dispute-Kategorien: {clause.disputeCategories.join(", ")}</p> : null}
    </div>
  );
}
