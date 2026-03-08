import { baseClauseBlocks } from "../clause-blocks";
import type { TemplateField } from "../field-types";
import type { TemplateDefinition } from "../template-base";
import { baseTemplateGroups } from "../template-groups";

const f = (field: TemplateField): TemplateField => ({
  marketplaceVisible: true,
  documentRenderable: true,
  printable: true,
  summaryVisible: true,
  ...field
});

const fields: TemplateField[] = [
  f({ id: "dokumententitel", name: "dokumententitel", label: "Dokumententitel", description: "Titel des Vorschussvertrags.", type: "text", required: true, defaultValue: "Vorschussvertrag", group: "basisdaten", sortOrder: 10, exportKey: "title" }),
  f({ id: "vorschussgeber", name: "vorschussgeber", label: "Vorschussgeber", description: "Finanzierende Partei.", type: "partyReference", required: true, group: "parteien", sortOrder: 20, exportKey: "advanceProvider" }),
  f({ id: "empfaenger", name: "empfaenger", label: "Empfänger", description: "Empfänger des Vorschusses.", type: "partyReference", required: true, group: "parteien", sortOrder: 30, exportKey: "recipient" }),
  f({ id: "forderungsquelle", name: "forderungsquelle", label: "Forderungsquelle", description: "Quelle der künftigen Forderungen/Erlöse.", type: "longText", required: true, group: "basisdaten", sortOrder: 40, exportKey: "receivableSource" }),
  f({ id: "erwarteterForderungswert", name: "erwarteterForderungswert", label: "Erwarteter Forderungswert", description: "Prognostizierter Wert der künftigen Forderungen.", type: "number", required: true, validation: [{ type: "min", value: 0.01 }], group: "oekonomik", sortOrder: 50, exportKey: "expectedReceivableValue" }),
  f({ id: "vorschussbetrag", name: "vorschussbetrag", label: "Vorschussbetrag", description: "Ausbezahlter Vorschuss.", type: "number", required: true, validation: [{ type: "min", value: 0.01 }], group: "oekonomik", sortOrder: 60, exportKey: "advanceAmount" }),
  f({ id: "waehrung", name: "waehrung", label: "Währung", description: "Währung der Abwicklung.", type: "currency", required: true, defaultValue: "CHF", group: "oekonomik", sortOrder: 70, exportKey: "currency" }),
  f({ id: "abschlag", name: "abschlag", label: "Abschlag (%)", description: "Abschlag auf prognostizierten Forderungswert.", type: "percent", validation: [{ type: "min", value: 0 }, { type: "max", value: 100 }], group: "oekonomik", sortOrder: 80, exportKey: "discountRate" }),
  f({ id: "gebuehren", name: "gebuehren", label: "Gebühren", description: "Gebührenstruktur inkl. Servicekomponenten.", type: "structuredObject", group: "oekonomik", sortOrder: 90, exportKey: "fees" }),
  f({ id: "abtretungsmechanik", name: "abtretungsmechanik", label: "Abtretungsmechanik", description: "Wie und wann Forderungen übergehen.", type: "longText", required: true, group: "marketplace", sortOrder: 100, exportKey: "assignmentMechanism" }),
  f({ id: "faelligkeitstrigger", name: "faelligkeitstrigger", label: "Fälligkeitstrigger", description: "Trigger, die Rückzahlungs-/Abrechnungsfälligkeit auslösen.", type: "structuredObject", required: true, group: "fristen", sortOrder: 110, exportKey: "maturityTriggers" }),
  f({ id: "nachweispflichten", name: "nachweispflichten", label: "Nachweispflichten", description: "Welche Nachweise regelmäßig zu liefern sind.", type: "structuredObject", required: true, group: "dokumente", sortOrder: 120, exportKey: "evidenceDuties" }),
  f({ id: "ausfallrisiko", name: "ausfallrisiko", label: "Ausfallrisiko", description: "Vertragliche Zuordnung des Ausfallrisikos.", type: "longText", required: true, group: "settlement", sortOrder: 130, exportKey: "defaultRiskAllocation" }),
  f({ id: "sicherheiten", name: "sicherheiten", label: "Sicherheiten", description: "Ergänzende Sicherheiten des Empfängers.", type: "structuredObject", group: "sicherheiten", sortOrder: 140, exportKey: "collateral" }),
  f({ id: "rueckabwicklung", name: "rueckabwicklung", label: "Rückabwicklung", description: "Mechanik bei Ausfall oder Vertragsbeendigung.", type: "longText", required: true, group: "settlement", sortOrder: 150, exportKey: "unwindRules" }),
  f({ id: "reportingPflichten", name: "reportingPflichten", label: "Reporting-Pflichten", description: "Intervall, Format und Inhalt des Reportings.", type: "structuredObject", required: true, group: "settlement", sortOrder: 160, exportKey: "reportingDuties" }),
  f({ id: "scoringMetadaten", name: "scoringMetadaten", label: "Scoring-Metadaten", description: "Kennzahlen für automatisiertes Risiko-Scoring.", type: "structuredObject", expertOnly: true, visibility: [{ kind: "audience", allowed: ["internal"] }], group: "marketplace", sortOrder: 170, exportKey: "scoringMetadata" }),
  f({ id: "dokumentnachweise", name: "dokumentnachweise", label: "Dokumentnachweise", description: "Rechnungen, Auftragsbestätigungen, Kontoauszüge.", type: "documentUpload", repeatable: true, visibility: [{ kind: "nda", required: true }], group: "dokumente", sortOrder: 180, exportKey: "supportingDocuments" }),
  f({ id: "rechtswahl", name: "rechtswahl", label: "Rechtswahl", description: "Anwendbares Recht.", type: "select", required: true, options: [{ label: "Schweizer Recht", value: "CH" }, { label: "Deutsches Recht", value: "DE" }, { label: "Englisches Recht", value: "EN" }], group: "dispute", sortOrder: 190, exportKey: "governingLaw" }),
  f({ id: "gerichtsstand", name: "gerichtsstand", label: "Gerichtsstand", description: "Streitbeilegungsforum.", type: "text", required: true, group: "dispute", sortOrder: 200, exportKey: "forum" }),
  f({ id: "marktplatzsichtbarkeit", name: "marktplatzsichtbarkeit", label: "Marktplatzsichtbarkeit", description: "Sichtbarkeit der Forderungsquelle und Performance-Daten.", type: "select", defaultValue: "nda", options: [{ label: "Summary", value: "summary" }, { label: "NDA", value: "nda" }, { label: "Intern", value: "internal" }], group: "marketplace", sortOrder: 210, exportKey: "marketVisibility" })
];

export const vorschussTemplate: TemplateDefinition = {
  type: "vorschuss",
  version: "1.0.0",
  title: "Vorschuss auf künftige Forderungen / Erlöse",
  subtitle: "Receivable-backed Advance mit Trigger- und Reporting-Logik",
  historicalContext: "Vorschussstrukturen wurden historisch genutzt, um Handelsflüsse vorzufinanzieren.",
  legalIntent: "Abbildung der Advance-Mechanik, Abtretungslogik, Nachweispflichten und Rückabwicklung.",
  groups: baseTemplateGroups,
  fields,
  clauseBlocks: baseClauseBlocks.filter((clause) => ["rechtswahl", "gerichtsstand", "event_of_default", "reportingpflicht", "mahnverfahren", "geheimhaltung", "uebertragbarkeit"].includes(clause.id)),
  validationRules: [
    { type: "numberNotAbove", fieldId: "vorschussbetrag", referenceFieldId: "erwarteterForderungswert", justificationFieldId: "scoringMetadaten", message: "Vorschussbetrag darf erwarteten Forderungswert nicht ohne Begründung überschreiten." },
    { type: "numberRange", fieldId: "abschlag", min: 0, max: 100, message: "Abschlag muss zwischen 0 und 100 liegen." }
  ],
  documentRendering: {
    titleFieldId: "dokumententitel",
    partyFieldIds: ["vorschussgeber", "empfaenger"],
    summaryFieldIds: ["vorschussbetrag", "erwarteterForderungswert", "abschlag", "faelligkeitstrigger"],
    signatureFieldIds: ["vorschussgeber", "empfaenger"]
  },
  marketplaceMeta: {
    listingTitleField: "dokumententitel",
    summaryFields: ["vorschussbetrag", "abschlag", "forderungsquelle", "faelligkeitstrigger"],
    internalOnlyFields: ["scoringMetadaten", "ausfallrisiko"],
    ndaProtectedFields: ["nachweispflichten", "dokumentnachweise", "rueckabwicklung"],
    defaultVisibility: "marketplace"
  },
  riskMeta: {
    riskInputs: ["ausfallrisiko", "abschlag", "sicherheiten", "scoringMetadaten"],
    weightings: { ausfallrisiko: 0.3, abschlag: 0.2, sicherheiten: -0.2, scoringMetadaten: 0.2 },
    scoreFormulaHint: "Hohes Ausfallrisiko und geringer Abschlag erhöhen Risiko; Sicherheiten wirken risikomindernd.",
    requiresManualReviewWhen: ["vorschussbetrag > erwarteterForderungswert", "marktplatzsichtbarkeit = internal"]
  },
  settlementMeta: {
    dueDateFieldIds: ["faelligkeitstrigger"],
    amountFieldIds: ["vorschussbetrag", "erwarteterForderungswert", "gebuehren"],
    triggerFieldIds: ["abtretungsmechanik", "rueckabwicklung"],
    eventMapping: { advancePaid: "PAYMENT_CONFIRMED", collectionDue: "PAYMENT_DUE", shortfall: "DEFAULT_TRIGGERED" }
  },
  disputeMeta: {
    defaultDisputeType: "TRANSFER_DISPUTE",
    evidenceFieldIds: ["nachweispflichten", "dokumentnachweise", "reportingPflichten"],
    jurisdictionFieldId: "gerichtsstand",
    escalationPath: ["notice", "mediation", "court_or_arbitration"]
  }
};
