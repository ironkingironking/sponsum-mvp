import type { CrossFieldValidationRule, TemplateField, ValidationRule, VisibilityContext } from "./field-types";
import type { TemplateDefinition } from "./template-base";
import { isFieldVisible, passesVisibilityRule } from "./visibility";

export type ValidationResult = {
  isValid: boolean;
  errors: Record<string, string[]>;
};

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function addError(errors: Record<string, string[]>, fieldId: string, message: string) {
  if (!errors[fieldId]) {
    errors[fieldId] = [];
  }
  errors[fieldId].push(message);
}

function checkRule(rule: ValidationRule, field: TemplateField, values: Record<string, unknown>): string | null {
  const value = values[field.id];

  if (rule.type === "required") {
    const missing = value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
    return missing ? rule.message || `${field.label} ist erforderlich.` : null;
  }

  if (rule.type === "min") {
    const numeric = asNumber(value);
    if (numeric === null) return null;
    return numeric < rule.value ? rule.message || `${field.label} muss mindestens ${rule.value} sein.` : null;
  }

  if (rule.type === "max") {
    const numeric = asNumber(value);
    if (numeric === null) return null;
    return numeric > rule.value ? rule.message || `${field.label} darf maximal ${rule.value} sein.` : null;
  }

  if (rule.type === "regex") {
    if (typeof value !== "string" || value.length === 0) {
      return null;
    }

    const regex = new RegExp(rule.pattern);
    return regex.test(value) ? null : rule.message || `${field.label} hat ein ungültiges Format.`;
  }

  if (rule.type === "dependency") {
    const passes = passesVisibilityRule(
      {
        kind: "field",
        fieldId: rule.fieldId,
        comparator: rule.comparator,
        value: rule.value as string | number | boolean | string[] | undefined
      },
      {
        expertMode: true,
        historicalMode: true,
        audience: "internal",
        ndaAccepted: true
      },
      values
    );

    if (!passes) {
      return null;
    }

    const currentMissing = value === null || value === undefined || value === "";
    return currentMissing ? rule.message : null;
  }

  return null;
}

function runCrossFieldRule(
  rule: CrossFieldValidationRule,
  fieldsById: Record<string, TemplateField>,
  values: Record<string, unknown>,
  context: VisibilityContext,
  errors: Record<string, string[]>
) {
  const targetField = fieldsById[rule.fieldId];
  if (targetField && !isFieldVisible(targetField, context, values)) {
    return;
  }

  if (rule.type === "dateNotBefore") {
    const left = asDate(values[rule.fieldId]);
    const right = asDate(values[rule.referenceFieldId]);

    if (left && right && left < right) {
      addError(errors, rule.fieldId, rule.message);
    }
    return;
  }

  if (rule.type === "numberRange") {
    const value = asNumber(values[rule.fieldId]);

    if (value === null) {
      return;
    }

    if (value < rule.min || value > rule.max) {
      addError(errors, rule.fieldId, rule.message);
    }
    return;
  }

  if (rule.type === "numberNotAbove") {
    const value = asNumber(values[rule.fieldId]);
    const ref = asNumber(values[rule.referenceFieldId]);

    if (value === null || ref === null || value <= ref) {
      return;
    }

    if (!rule.justificationFieldId) {
      addError(errors, rule.fieldId, rule.message);
      return;
    }

    const justification = values[rule.justificationFieldId];
    const hasJustification = typeof justification === "string" ? justification.trim().length > 0 : Boolean(justification);

    if (!hasJustification) {
      addError(errors, rule.fieldId, rule.message);
      addError(errors, rule.justificationFieldId, "Begründung erforderlich.");
    }
    return;
  }

  if (rule.type === "requiredWhen") {
    const triggerRulePasses = passesVisibilityRule(
      {
        kind: "field",
        fieldId: rule.dependsOnFieldId,
        comparator: rule.dependsOnComparator,
        value: rule.dependsOnValue as string | number | boolean | string[] | undefined
      },
      {
        expertMode: true,
        historicalMode: true,
        audience: "internal",
        ndaAccepted: true
      },
      values
    );

    if (!triggerRulePasses) {
      return;
    }

    const requiredValue = values[rule.fieldId];
    if (requiredValue === null || requiredValue === undefined || requiredValue === "") {
      addError(errors, rule.fieldId, rule.message);
    }
  }
}

export function validateTemplateData(
  template: TemplateDefinition,
  values: Record<string, unknown>,
  context: VisibilityContext
): ValidationResult {
  const errors: Record<string, string[]> = {};
  const fieldsById = Object.fromEntries(template.fields.map((field) => [field.id, field])) as Record<string, TemplateField>;

  for (const field of template.fields) {
    if (!isFieldVisible(field, context, values)) {
      continue;
    }

    if (field.required) {
      const message = checkRule({ type: "required" }, field, values);
      if (message) {
        addError(errors, field.id, message);
      }
    }

    if (field.type === "percent") {
      const numeric = asNumber(values[field.id]);
      if (numeric !== null && (numeric < 0 || numeric > 100)) {
        addError(errors, field.id, `${field.label} muss zwischen 0 und 100 liegen.`);
      }
    }

    for (const rule of field.validation || []) {
      const message = checkRule(rule, field, values);
      if (message) {
        addError(errors, field.id, message);
      }
    }
  }

  for (const crossRule of template.validationRules) {
    runCrossFieldRule(crossRule, fieldsById, values, context, errors);
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
