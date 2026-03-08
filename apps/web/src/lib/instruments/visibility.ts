import type { TemplateField, VisibilityContext, VisibilityRule } from "./field-types";

function compareRuleValue(value: unknown, comparator: string, expected: unknown): boolean {
  switch (comparator) {
    case "equals":
      return value === expected;
    case "notEquals":
      return value !== expected;
    case "in":
      return Array.isArray(expected) ? expected.includes(value as never) : false;
    case "truthy":
      return Boolean(value);
    case "falsy":
      return !value;
    default:
      return true;
  }
}

export function passesVisibilityRule(
  rule: VisibilityRule,
  context: VisibilityContext,
  values: Record<string, unknown>
): boolean {
  if (rule.kind === "mode") {
    const enabled = rule.mode === "expert" ? context.expertMode : context.historicalMode;
    return enabled === rule.enabled;
  }

  if (rule.kind === "audience") {
    return rule.allowed.includes(context.audience);
  }

  if (rule.kind === "nda") {
    return rule.required ? context.ndaAccepted : true;
  }

  if (rule.kind === "field") {
    const fieldValue = values[rule.fieldId];

    if (rule.comparator === "truthy") {
      return Boolean(fieldValue);
    }

    if (rule.comparator === "falsy") {
      return !fieldValue;
    }

    return compareRuleValue(fieldValue, rule.comparator, rule.value);
  }

  return true;
}

export function isFieldVisible(field: TemplateField, context: VisibilityContext, values: Record<string, unknown>): boolean {
  if (field.expertOnly && !context.expertMode) {
    return false;
  }

  if (field.historical && !context.historicalMode) {
    return false;
  }

  if (context.audience === "marketplace" && field.marketplaceVisible === false) {
    return false;
  }

  if (!field.visibility || field.visibility.length === 0) {
    return true;
  }

  return field.visibility.every((rule) => passesVisibilityRule(rule, context, values));
}
