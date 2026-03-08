"use client";

import type { ClaimEvidenceType } from "@/lib/claims";

type ClaimEvidenceSuggestionsProps = {
  selected: ClaimEvidenceType[];
  suggestions: ClaimEvidenceType[];
  onChange: (value: ClaimEvidenceType[]) => void;
};

export function ClaimEvidenceSuggestions({ selected, suggestions, onChange }: ClaimEvidenceSuggestionsProps) {
  const uniqueSuggestions = Array.from(new Set(suggestions));

  function toggle(option: ClaimEvidenceType) {
    if (selected.includes(option)) {
      onChange(selected.filter((entry) => entry !== option));
      return;
    }
    onChange([...selected, option]);
  }

  return (
    <div className="dashboard-list">
      {uniqueSuggestions.map((option) => (
        <label key={option} className="dashboard-list-item">
          <span>{option}</span>
          <input type="checkbox" checked={selected.includes(option)} onChange={() => toggle(option)} />
        </label>
      ))}
    </div>
  );
}
