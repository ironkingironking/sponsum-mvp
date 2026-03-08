"use client";

type ExpertModeToggleProps = {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
};

export function ExpertModeToggle({ enabled, onChange }: ExpertModeToggleProps) {
  return (
    <label className="inline-control">
      <input type="checkbox" checked={enabled} onChange={(event) => onChange(event.target.checked)} />
      Expertenmodus
    </label>
  );
}
