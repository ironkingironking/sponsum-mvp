"use client";

import type { ClauseBlock } from "@/lib/instruments";

type ClauseSelectorProps = {
  clauses: ClauseBlock[];
  selectedIds: string[];
  overrides: Record<string, string>;
  disabled?: boolean;
  onToggle: (clauseId: string, selected: boolean) => void;
  onOverrideChange: (clauseId: string, text: string) => void;
};

export function ClauseSelector({ clauses, selectedIds, overrides, disabled = false, onToggle, onOverrideChange }: ClauseSelectorProps) {
  return (
    <div className="grid" style={{ gap: 10 }}>
      {clauses.map((clause) => {
        const selected = selectedIds.includes(clause.id);
        const textValue = overrides[clause.id] ?? clause.text;

        return (
          <div key={clause.id} style={{ border: "1px solid #d7dce4", borderRadius: 10, padding: 10, background: "#fff" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
              <input type="checkbox" checked={selected} disabled={disabled} onChange={(event) => onToggle(clause.id, event.target.checked)} />
              {clause.title}
            </label>
            <p style={{ margin: "6px 0", color: "#64748b", fontSize: 12 }}>
              Kategorie: {clause.category} {clause.historical ? "· historisch" : ""}
            </p>
            {selected ? (
              <textarea
                rows={3}
                value={textValue}
                disabled={disabled || !clause.editable}
                onChange={(event) => onOverrideChange(clause.id, event.target.value)}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
