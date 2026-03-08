"use client";

import type { ClaimBlueprint } from "@/lib/claims";
import { severityToColor } from "@/lib/dashboard";

type ClaimBlueprintSelectorProps = {
  blueprints: ClaimBlueprint[];
  selectedBlueprintId?: string;
  onSelect: (blueprintId: string | "custom") => void;
};

export function ClaimBlueprintSelector({ blueprints, selectedBlueprintId, onSelect }: ClaimBlueprintSelectorProps) {
  return (
    <div className="dashboard-list">
      <button
        type="button"
        className={selectedBlueprintId === "custom" ? "claim-target-card selected" : "claim-target-card"}
        onClick={() => onSelect("custom")}
      >
        <div>
          <strong>Custom Claim</strong>
          <p>Eigene Claim-Definition ohne Blueprint.</p>
        </div>
      </button>
      {blueprints.map((blueprint) => (
        <button
          key={blueprint.claimBlueprintId}
          type="button"
          className={selectedBlueprintId === blueprint.claimBlueprintId ? "claim-target-card selected" : "claim-target-card"}
          onClick={() => onSelect(blueprint.claimBlueprintId)}
        >
          <div>
            <strong>{blueprint.label}</strong>
            <p>{blueprint.description}</p>
            <p>
              target: {blueprint.compatibleTargetTypes.join(", ")} · remedies: {blueprint.suggestedRemedies.join(", ")}
            </p>
          </div>
          <span style={{ color: severityToColor(blueprint.severity), fontWeight: 700 }}>{blueprint.severity}</span>
        </button>
      ))}
    </div>
  );
}
