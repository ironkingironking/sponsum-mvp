import type { TemplateDefinition } from "@/lib/instruments";

type TemplatePreviewCardProps = {
  template: TemplateDefinition;
  values?: Record<string, unknown>;
  href?: string;
  badge?: string;
};

function asText(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return JSON.stringify(value);
}

export function TemplatePreviewCard({ template, values = {}, href, badge }: TemplatePreviewCardProps) {
  const listingTitleField = template.marketplaceMeta.listingTitleField;
  const heading = listingTitleField ? asText(values[listingTitleField]) : template.title;

  const summaryRows = template.marketplaceMeta.summaryFields.slice(0, 4).map((fieldId) => {
    const field = template.fields.find((entry) => entry.id === fieldId);
    return {
      key: fieldId,
      label: field?.label || fieldId,
      value: asText(values[fieldId])
    };
  });

  return (
    <div className="instrument-preview-card">
      <div className="instrument-preview-header">
        <strong>{heading}</strong>
        {badge ? <span style={{ fontSize: 12, color: "#334155", border: "1px solid #d7dce4", borderRadius: 999, padding: "2px 8px" }}>{badge}</span> : null}
      </div>
      <p style={{ margin: 0, color: "#475569", fontSize: 14 }}>{template.subtitle}</p>
      <div className="grid" style={{ gap: 6 }}>
        {summaryRows.map((row) => (
          <div key={row.key} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
            <span style={{ color: "#64748b" }}>{row.label}</span>
            <span style={{ color: "#0f172a", textAlign: "right" }}>{row.value}</span>
          </div>
        ))}
      </div>
      {href ? (
        <a href={href} className="instrument-link-button">
          Details
        </a>
      ) : null}
    </div>
  );
}
