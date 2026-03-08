"use client";

import type { ClaimRemedyType } from "@/lib/claims";

type ClaimRemedySelectorProps = {
  selected: ClaimRemedyType[];
  options: ClaimRemedyType[];
  onChange: (value: ClaimRemedyType[]) => void;
};

export function ClaimRemedySelector({ selected, options, onChange }: ClaimRemedySelectorProps) {
  const uniqueOptions = Array.from(new Set(options));

  function toggle(option: ClaimRemedyType) {
    if (selected.includes(option)) {
      onChange(selected.filter((entry) => entry !== option));
      return;
    }
    onChange([...selected, option]);
  }

  return (
    <div className="dashboard-list">
      {uniqueOptions.map((option) => (
        <label key={option} className="dashboard-list-item">
          <span>{option}</span>
          <input type="checkbox" checked={selected.includes(option)} onChange={() => toggle(option)} />
        </label>
      ))}
    </div>
  );
}
