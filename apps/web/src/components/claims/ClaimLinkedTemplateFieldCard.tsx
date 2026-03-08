import type { InstrumentContext } from "@/lib/claims";

type ClaimLinkedTemplateFieldCardProps = {
  context: InstrumentContext;
  fieldId?: string;
  expectedValue?: unknown;
  actualValue?: unknown;
};

export function ClaimLinkedTemplateFieldCard({ context, fieldId, expectedValue, actualValue }: ClaimLinkedTemplateFieldCardProps) {
  if (!fieldId) {
    return null;
  }

  const field = context.template.fields.find((entry) => entry.id === fieldId);
  if (!field) {
    return null;
  }

  return (
    <div className="claim-link-card">
      <strong>Template-Feld</strong>
      <p>
        {field.label} ({field.id})
      </p>
      <p>{field.description}</p>
      <div className="claim-expected-actual">
        <div>
          <strong>Soll</strong>
          <pre>{JSON.stringify(expectedValue ?? context.values[field.id] ?? "k. A.", null, 2)}</pre>
        </div>
        <div>
          <strong>Ist</strong>
          <pre>{JSON.stringify(actualValue ?? context.observedValues?.[field.id] ?? "k. A.", null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}
