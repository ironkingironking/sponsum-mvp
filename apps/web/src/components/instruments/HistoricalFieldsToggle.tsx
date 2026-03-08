"use client";

type HistoricalFieldsToggleProps = {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
};

export function HistoricalFieldsToggle({ enabled, onChange }: HistoricalFieldsToggleProps) {
  return (
    <label className="inline-control">
      <input type="checkbox" checked={enabled} onChange={(event) => onChange(event.target.checked)} />
      Historische Parameter anzeigen
    </label>
  );
}
