import type { ClaimTargetType } from "@/lib/claims";

type DisputeTargetBadgeProps = {
  targetType: ClaimTargetType;
};

const labelByTargetType: Record<ClaimTargetType, string> = {
  template_field: "Template-Feld",
  clause_block: "Klauselblock",
  settlement_event: "Settlement-Event",
  document_requirement: "Dokumentenpflicht",
  uploaded_document: "Hochgeladenes Dokument",
  obligation: "Obligation",
  payment_schedule_entry: "Zahlungsplan-Eintrag",
  instrument_party: "Instrument-Partei",
  custom: "Custom"
};

const colorByTargetType: Record<ClaimTargetType, string> = {
  template_field: "#1d4ed8",
  clause_block: "#9333ea",
  settlement_event: "#c2410c",
  document_requirement: "#b91c1c",
  uploaded_document: "#7c2d12",
  obligation: "#0f766e",
  payment_schedule_entry: "#0ea5e9",
  instrument_party: "#047857",
  custom: "#475569"
};

export function DisputeTargetBadge({ targetType }: DisputeTargetBadgeProps) {
  return (
    <span className="dispute-target-badge" style={{ color: colorByTargetType[targetType], borderColor: colorByTargetType[targetType] }}>
      {labelByTargetType[targetType]}
    </span>
  );
}
