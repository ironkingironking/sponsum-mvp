"use client";

import type { ClaimTargetCandidate } from "@/lib/claims";
import { severityToColor } from "@/lib/dashboard";

type ClaimTargetSelectorProps = {
  targets: ClaimTargetCandidate[];
  selectedId?: string;
  onSelect: (targetId: string) => void;
};

export function ClaimTargetSelector({ targets, selectedId, onSelect }: ClaimTargetSelectorProps) {
  return (
    <div className="dashboard-list">
      {targets.map((target) => (
        <button
          key={target.id}
          type="button"
          className={target.id === selectedId ? "claim-target-card selected" : "claim-target-card"}
          onClick={() => onSelect(target.id)}
        >
          <div>
            <strong>{target.label}</strong>
            <p>
              {target.targetType} {target.groupKey ? `· ${target.groupKey}` : ""}
            </p>
            <p>{target.description}</p>
          </div>
          {target.severityHint ? (
            <span style={{ color: severityToColor(target.severityHint), fontWeight: 700 }}>{target.severityHint}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
