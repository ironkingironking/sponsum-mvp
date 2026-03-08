import { PropsWithChildren } from "react";

type InstrumentGroupSectionProps = PropsWithChildren<{
  title: string;
  description: string;
  defaultExpanded?: boolean;
}>;

export function InstrumentGroupSection({ title, description, defaultExpanded = false, children }: InstrumentGroupSectionProps) {
  return (
    <details open={defaultExpanded} style={{ border: "1px solid #d7dce4", borderRadius: 12, background: "#fff" }}>
      <summary style={{ cursor: "pointer", listStyle: "none", padding: 14, borderBottom: "1px solid #eef2f7" }}>
        <strong>{title}</strong>
        <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>{description}</p>
      </summary>
      <div style={{ padding: 14, display: "grid", gap: 12 }}>{children}</div>
    </details>
  );
}
