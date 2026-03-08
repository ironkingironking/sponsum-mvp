import type { ClaimTargetCandidate } from "@/lib/claims";

type ClaimTargetSummaryProps = {
  target?: ClaimTargetCandidate;
};

export function ClaimTargetSummary({ target }: ClaimTargetSummaryProps) {
  if (!target) {
    return <p className="dashboard-empty">Noch kein Ziel ausgewählt.</p>;
  }

  return (
    <div className="claim-target-summary">
      <h4>{target.label}</h4>
      <p>{target.description}</p>
      <p>
        Zieltyp: <strong>{target.targetType}</strong>
      </p>
      {target.groupKey ? (
        <p>
          Gruppe: <strong>{target.groupKey}</strong>
        </p>
      ) : null}
      {target.expectedValue !== undefined || target.actualValue !== undefined ? (
        <div className="claim-expected-actual">
          <div>
            <strong>Soll</strong>
            <pre>{JSON.stringify(target.expectedValue ?? "n/a", null, 2)}</pre>
          </div>
          <div>
            <strong>Ist</strong>
            <pre>{JSON.stringify(target.actualValue ?? "n/a", null, 2)}</pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
