"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { TemplateDefinition, VisibilityAudience, VisibilityContext } from "@/lib/instruments";
import { isFieldVisible, makeDraftFromTemplate, validateTemplateData } from "@/lib/instruments";
import { ClauseSelector } from "./ClauseSelector";
import { ExpertModeToggle } from "./ExpertModeToggle";
import { HistoricalFieldsToggle } from "./HistoricalFieldsToggle";
import { InstrumentFieldRenderer } from "./InstrumentFieldRenderer";
import { InstrumentGroupSection } from "./InstrumentGroupSection";

export type InstrumentTemplateSubmitPayload = {
  values: Record<string, unknown>;
  selectedClauseIds: string[];
  clauseOverrides: Record<string, string>;
  errors: Record<string, string[]>;
};

type InstrumentTemplateRendererProps = {
  template: TemplateDefinition;
  initialValues?: Record<string, unknown>;
  initialSelectedClauseIds?: string[];
  initialClauseOverrides?: Record<string, string>;
  defaultAudience?: VisibilityAudience;
  readOnly?: boolean;
  showSubmitButton?: boolean;
  onSubmit?: (payload: InstrumentTemplateSubmitPayload) => void;
};

function withUnique(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

export function InstrumentTemplateRenderer({
  template,
  initialValues,
  initialSelectedClauseIds,
  initialClauseOverrides,
  defaultAudience = "internal",
  readOnly = false,
  showSubmitButton = true,
  onSubmit
}: InstrumentTemplateRendererProps) {
  const draftDefaults = useMemo(() => makeDraftFromTemplate(template), [template]);
  const [values, setValues] = useState<Record<string, unknown>>({
    ...draftDefaults.values,
    ...initialValues
  });
  const [selectedClauseIds, setSelectedClauseIds] = useState<string[]>(
    withUnique([...(draftDefaults.selectedClauseIds || []), ...(initialSelectedClauseIds || [])])
  );
  const [clauseOverrides, setClauseOverrides] = useState<Record<string, string>>(initialClauseOverrides || {});
  const [expertMode, setExpertMode] = useState(false);
  const [historicalMode, setHistoricalMode] = useState(false);
  const [audience, setAudience] = useState<VisibilityAudience>(defaultAudience);
  const [ndaAccepted, setNdaAccepted] = useState(defaultAudience === "internal");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [status, setStatus] = useState<string | null>(null);

  const visibilityContext: VisibilityContext = useMemo(
    () => ({
      expertMode,
      historicalMode,
      audience,
      ndaAccepted: audience === "internal" ? true : ndaAccepted
    }),
    [expertMode, historicalMode, audience, ndaAccepted]
  );

  const groups = useMemo(
    () =>
      [...template.groups]
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((group) => {
          const fields = template.fields
            .filter((field) => field.group === group.id)
            .filter((field) => isFieldVisible(field, visibilityContext, values))
            .sort((left, right) => left.sortOrder - right.sortOrder);

          return {
            group,
            fields
          };
        }),
    [template.groups, template.fields, visibilityContext, values]
  );

  function handleFieldChange(fieldId: string, nextValue: unknown) {
    setValues((current) => ({ ...current, [fieldId]: nextValue }));
    setErrors((current) => {
      if (!current[fieldId]) {
        return current;
      }
      const next = { ...current };
      delete next[fieldId];
      return next;
    });
  }

  function handleClauseToggle(clauseId: string, selected: boolean) {
    setSelectedClauseIds((current) => {
      if (selected) {
        return withUnique([...current, clauseId]);
      }
      return current.filter((id) => id !== clauseId);
    });
  }

  function handleClauseOverrideChange(clauseId: string, text: string) {
    setClauseOverrides((current) => ({
      ...current,
      [clauseId]: text
    }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = validateTemplateData(template, values, visibilityContext);
    setErrors(result.errors);

    if (result.isValid) {
      setStatus("Validierung erfolgreich.");
    } else {
      setStatus("Validierung fehlgeschlagen. Bitte markierte Felder prüfen.");
    }

    onSubmit?.({
      values,
      selectedClauseIds,
      clauseOverrides,
      errors: result.errors
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid" style={{ gap: 12 }}>
      <div className="instrument-meta-card">
        <strong>{template.title}</strong>
        <p style={{ margin: 0, color: "#475569", fontSize: 14 }}>{template.subtitle}</p>
        <div className="instrument-toolbar">
          <ExpertModeToggle enabled={expertMode} onChange={setExpertMode} />
          <HistoricalFieldsToggle enabled={historicalMode} onChange={setHistoricalMode} />
          <label className="inline-control">
            Audience
            <select value={audience} onChange={(event) => setAudience(event.target.value as VisibilityAudience)} disabled={readOnly}>
              <option value="internal">Internal</option>
              <option value="counterparty">Counterparty</option>
              <option value="marketplace">Marketplace</option>
            </select>
          </label>
          <label className="inline-control">
            <input
              type="checkbox"
              checked={audience === "internal" ? true : ndaAccepted}
              disabled={readOnly || audience === "internal"}
              onChange={(event) => setNdaAccepted(event.target.checked)}
            />
            NDA akzeptiert
          </label>
        </div>
      </div>

      {groups.map(({ group, fields }) => {
        const hasClauseSelectorField = fields.some((field) => field.type === "clauseSelector");
        const plainFields = fields.filter((field) => field.type !== "clauseSelector");
        const shouldShowClauseSelector = hasClauseSelectorField || (group.id === "klauseln" && template.clauseBlocks.length > 0);
        if (plainFields.length === 0 && !shouldShowClauseSelector) {
          return null;
        }

        return (
          <InstrumentGroupSection
            key={group.id}
            title={group.label}
            description={group.description}
            defaultExpanded={Boolean(group.defaultExpanded)}
          >
            {plainFields.map((field) => (
              <InstrumentFieldRenderer
                key={field.id}
                field={field}
                value={values[field.id]}
                errors={errors[field.id]}
                disabled={readOnly}
                onChange={handleFieldChange}
              />
            ))}
            {shouldShowClauseSelector ? (
              <div className="grid" style={{ gap: 6 }}>
                <strong>Klauselbausteine</strong>
                <ClauseSelector
                  clauses={template.clauseBlocks}
                  selectedIds={selectedClauseIds}
                  overrides={clauseOverrides}
                  disabled={readOnly}
                  onToggle={handleClauseToggle}
                  onOverrideChange={handleClauseOverrideChange}
                />
              </div>
            ) : null}
          </InstrumentGroupSection>
        );
      })}

      {showSubmitButton ? (
        <div className="instrument-actions">
          <button type="submit" disabled={readOnly}>
            Validierung prüfen
          </button>
          {status ? <p style={{ margin: 0, color: "#334155" }}>{status}</p> : null}
        </div>
      ) : null}
    </form>
  );
}
