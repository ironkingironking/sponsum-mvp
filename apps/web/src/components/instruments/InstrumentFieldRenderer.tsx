"use client";

import type { ChangeEvent } from "react";
import type { TemplateField } from "@/lib/instruments";

type InstrumentFieldRendererProps = {
  field: TemplateField;
  value: unknown;
  errors?: string[];
  disabled?: boolean;
  onChange: (fieldId: string, value: unknown) => void;
};

function inputBase(disabled?: boolean) {
  return {
    opacity: disabled ? 0.7 : 1,
    cursor: disabled ? "not-allowed" : "text"
  } as const;
}

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value, null, 2);
}

function renderInput(field: TemplateField, value: unknown, disabled: boolean, onChange: (value: unknown) => void) {
  const commonProps = {
    disabled,
    placeholder: field.placeholder,
    style: inputBase(disabled)
  };

  if (field.type === "longText") {
    return <textarea rows={4} {...commonProps} value={toStringValue(value)} onChange={(event) => onChange(event.target.value)} />;
  }

  if (field.type === "number" || field.type === "percent") {
    return (
      <input
        type="number"
        step="0.01"
        {...commonProps}
        value={toStringValue(value)}
        onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))}
      />
    );
  }

  if (field.type === "currency") {
    return (
      <input
        type="text"
        maxLength={5}
        {...commonProps}
        value={toStringValue(value)}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        placeholder={field.placeholder || "CHF"}
      />
    );
  }

  if (field.type === "date") {
    return <input type="date" {...commonProps} value={toStringValue(value)} onChange={(event) => onChange(event.target.value)} />;
  }

  if (field.type === "datetime") {
    return <input type="datetime-local" {...commonProps} value={toStringValue(value)} onChange={(event) => onChange(event.target.value)} />;
  }

  if (field.type === "boolean") {
    return (
      <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={Boolean(value)} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
        {field.helpText || "Aktivieren"}
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <select {...commonProps} value={toStringValue(value)} onChange={(event) => onChange(event.target.value)}>
        <option value="">Bitte auswählen</option>
        {(field.options || []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "multiSelect") {
    const selected = Array.isArray(value) ? (value as string[]) : [];

    return (
      <select
        multiple
        {...commonProps}
        value={selected}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => {
          const next = Array.from(event.target.selectedOptions).map((option) => option.value);
          onChange(next);
        }}
      >
        {(field.options || []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "structuredObject") {
    return (
      <textarea
        rows={5}
        {...commonProps}
        value={toStringValue(value)}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder || "JSON oder strukturierter Text"}
      />
    );
  }

  if (field.type === "address" || field.type === "partyReference" || field.type === "documentUpload" || field.type === "clauseSelector") {
    return <input type="text" {...commonProps} value={toStringValue(value)} onChange={(event) => onChange(event.target.value)} />;
  }

  return <input type="text" {...commonProps} value={toStringValue(value)} onChange={(event) => onChange(event.target.value)} />;
}

export function InstrumentFieldRenderer({ field, value, errors, disabled = false, onChange }: InstrumentFieldRendererProps) {
  return (
    <div className="grid" style={{ gap: 6 }}>
      <label style={{ fontWeight: 600 }}>{field.label}</label>
      <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>{field.description}</p>
      {renderInput(field, value, disabled, (next) => onChange(field.id, next))}
      {field.helpText ? <p style={{ margin: 0, color: "#94a3b8", fontSize: 12 }}>{field.helpText}</p> : null}
      {(errors || []).map((error) => (
        <p key={error} style={{ margin: 0, color: "#b91c1c", fontSize: 12 }}>
          {error}
        </p>
      ))}
    </div>
  );
}
