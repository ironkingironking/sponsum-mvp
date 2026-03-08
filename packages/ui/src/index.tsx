import React, { PropsWithChildren } from "react";

export function Card({ children }: PropsWithChildren) {
  return <div style={{ border: "1px solid #d7dce4", borderRadius: 12, padding: 16, background: "#fff" }}>{children}</div>;
}

export function Badge({ label }: { label: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        borderRadius: 999,
        border: "1px solid #ccd4de",
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 600,
        color: "#334155"
      }}
    >
      {label}
    </span>
  );
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h2 style={{ margin: 0, fontSize: 22 }}>{title}</h2>
      {subtitle ? <p style={{ marginTop: 6, color: "#475569" }}>{subtitle}</p> : null}
    </div>
  );
}
