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
  f({ id: "dokumententitel", name: "dokumententitel", label: "Dokumententitel", description: "Titel des Schuldscheins.", type: "text", required: true, defaultValue: "Schuldschein", group: "basisdaten", sortOrder: 10, exportKey: "title" }),
  f({ id: "schuldner", name: "schuldner", label: "Schuldner", description: "Primär verpflichtete Partei.", type: "partyReference", required: true, group: "parteien", sortOrder: 20, exportKey: "debtor" }),
  f({ id: "glaeubiger", name: "glaeubiger", label: "Gläubiger", description: "Forderungsinhaber.", type: "partyReference", required: true, group: "parteien", sortOrder: 30, exportKey: "creditor" }),
  f({ id: "schuldgrund", name: "schuldgrund", label: "Schuldgrund", description: "Wirtschaftlicher oder rechtlicher Entstehungsgrund.", type: "longText", required: true, group: "basisdaten", sortOrder: 40, exportKey: "causeOfDebt" }),
  f({ id: "kapitalbetrag", name: "kapitalbetrag", label: "Kapitalbetrag", description: "Hauptforderung ohne Zinsen.", type: "number", required: true, validation: [{ type: "min", value: 0.01 }], group: "oekonomik", sortOrder: 50, exportKey: "principalAmount" }),
  f({ id: "waehrung", name: "waehrung", label: "Währung", description: "Währungscode.", type: "currency", required: true, defaultValue: "CHF", group: "oekonomik", sortOrder: 60, exportKey: "currency" }),
  f({ id: "valutierungsdatum", name: "valutierungsdatum", label: "Valutierungsdatum", description: "Datum der Kapitalbereitstellung.", type: "date", required: true, group: "fristen", sortOrder: 70, exportKey: "valueDate" }),
  f({ id: "zinsmodell", name: "zinsmodell", label: "Zinsmodell", description: "Fix, variabel oder stufenweise.", type: "select", required: true, options: [{ label: "Fix", value: "fixed" }, { label: "Variabel", value: "floating" }, { label: "Stufenmodell", value: "step-up" }], group: "oekonomik", sortOrder: 80, exportKey: "interestModel" }),
  f({ id: "zinssatz", name: "zinssatz", label: "Zinssatz (%)", description: "Nominaler Zinssatz.", type: "percent", required: true, validation: [{ type: "min", value: 0 }, { type: "max", value: 100 }], group: "oekonomik", sortOrder: 90, exportKey: "interestRate" }),
  f({ id: "zinsperiode", name: "zinsperiode", label: "Zinsperiode", description: "Intervall der Zinszahlung.", type: "select", options: [{ label: "Monatlich", value: "monthly" }, { label: "Quartalsweise", value: "quarterly" }, { label: "Jährlich", value: "yearly" }], required: true, group: "oekonomik", sortOrder: 100, exportKey: "interestPeriod" }),
  f({ id: "tilgungsmodus", name: "tilgungsmodus", label: "Tilgungsmodus", description: "Amortisation, endfällig oder hybrid.", type: "select", required: true, options: [{ label: "Endfällig", value: "bullet" }, { label: "Linear", value: "linear" }, { label: "Annuität", value: "annuity" }], group: "oekonomik", sortOrder: 110, exportKey: "amortizationMode" }),
  f({ id: "ratenplan", name: "ratenplan", label: "Ratenplan", description: "Detaillierter Plan für Tilgungsraten.", type: "structuredObject", expertOnly: true, group: "settlement", sortOrder: 120, exportKey: "installmentPlan" }),
  f({ id: "endfaelligkeit", name: "endfaelligkeit", label: "Endfälligkeit", description: "Datum der vollständigen Rückzahlung.", type: "date", required: true, group: "fristen", sortOrder: 130, exportKey: "finalMaturity", disputeRelevant: true, obligationType: "payment_due", breachModes: ["late_payment", "non_payment"], relatedSettlementEventTypes: ["PAYMENT_DUE", "DEFAULT_TRIGGERED"], remedyTypes: ["payment_order", "acceleration"], severityHint: "warning" }),
  f({ id: "vorzeitigeRueckzahlung", name: "vorzeitigeRueckzahlung", label: "Vorzeitige Rückzahlung", description: "Regeln für vorzeitige Rückführung.", type: "longText", group: "fristen", sortOrder: 140, exportKey: "prepaymentRules" }),
  f({ id: "verzugszins", name: "verzugszins", label: "Verzugszins (%)", description: "Zusätzlicher Zinssatz bei Verzug.", type: "percent", validation: [{ type: "min", value: 0 }, { type: "max", value: 100 }], group: "settlement", sortOrder: 150, exportKey: "defaultInterestRate", disputeRelevant: true, obligationType: "default_interest", breachModes: ["interest_dispute"], remedyTypes: ["interest_adjustment", "declaratory_relief"], severityHint: "warning" }),
  f({ id: "mahnstufen", name: "mahnstufen", label: "Mahnstufen", description: "Stufenmodell für Mahnung und Eskalation.", type: "structuredObject", group: "settlement", sortOrder: 160, exportKey: "dunningStages" }),
  f({ id: "sicherheiten", name: "sicherheiten", label: "Sicherheiten", description: "Beschriebene Sicherheiten inkl. Werthaltigkeit.", type: "structuredObject", group: "sicherheiten", sortOrder: 170, exportKey: "collateral", disputeRelevant: true, obligationType: "collateral_delivery", breachModes: ["collateral_missing", "collateral_quality_dispute"], relatedDocumentTypes: ["origin_document"], remedyTypes: ["security_topup", "enforcement"], severityHint: "critical" }),
  f({ id: "mitverpflichtete", name: "mitverpflichtete", label: "Mitverpflichtete", description: "Solidarschuldner oder Mitunterzeichner.", type: "partyReference", repeatable: true, group: "sicherheiten", sortOrder: 180, exportKey: "coObligors" }),
  f({ id: "schuldanerkennung", name: "schuldanerkennung", label: "Schuldanerkennung", description: "Ob ein deklaratorisches/konstitutives Anerkenntnis enthalten ist.", type: "boolean", defaultValue: true, group: "basisdaten", sortOrder: 190, exportKey: "acknowledgement" }),
  f({ id: "beweisfunktion", name: "beweisfunktion", label: "Beweisfunktion", description: "Beweisrechtliche Wirkung des Dokuments.", type: "longText", expertOnly: true, group: "dispute", sortOrder: 200, exportKey: "evidenceFunction" }),
  f({ id: "notarielleOption", name: "notarielleOption", label: "Notarielle Option", description: "Optionale notarielle Beurkundung.", type: "boolean", defaultValue: false, group: "dokumente", sortOrder: 210, exportKey: "notarialOption" }),
  f({ id: "vollstreckungsunterwerfung", name: "vollstreckungsunterwerfung", label: "Vollstreckungsunterwerfung", description: "Sofortige Vollstreckbarkeit aus Urkunde.", type: "boolean", expertOnly: true, visibility: [{ kind: "field", fieldId: "notarielleOption", comparator: "equals", value: true }], group: "dispute", sortOrder: 220, exportKey: "submissionToEnforcement" }),
  f({ id: "anhangsdokumente", name: "anhangsdokumente", label: "Anhangsdokumente", description: "Anhänge wie Kontoauszüge, Sicherheitenregister, Verträge.", type: "documentUpload", repeatable: true, group: "dokumente", sortOrder: 230, exportKey: "attachments" }),
  f({ id: "riskMarker", name: "riskMarker", label: "Risk Marker", description: "Interne Markierung für Due-Diligence oder Sonderprüfung.", type: "multiSelect", expertOnly: true, visibility: [{ kind: "audience", allowed: ["internal"] }], options: [{ label: "Hoher LTV", value: "high-ltv" }, { label: "Schwache Bonität", value: "weak-credit" }, { label: "Datenlücke", value: "data-gap" }], group: "marketplace", sortOrder: 240, exportKey: "riskFlags" }),
  f({ id: "rechtswahl", name: "rechtswahl", label: "Rechtswahl", description: "Anwendbares Recht.", type: "select", required: true, options: [{ label: "Schweizer Recht", value: "CH" }, { label: "Deutsches Recht", value: "DE" }, { label: "Englisches Recht", value: "EN" }], group: "dispute", sortOrder: 250, exportKey: "governingLaw" }),
  f({ id: "gerichtsstand", name: "gerichtsstand", label: "Gerichtsstand", description: "Zuständiges Gericht oder Ort.", type: "text", required: true, group: "dispute", sortOrder: 260, exportKey: "forum" }),
  f({ id: "marktplatzsichtbarkeit", name: "marktplatzsichtbarkeit", label: "Marktplatzsichtbarkeit", description: "Sichtbarkeit für Investoren/Gegenparteien.", type: "select", defaultValue: "summary", options: [{ label: "Summary", value: "summary" }, { label: "NDA", value: "nda" }, { label: "Intern", value: "internal" }], group: "marketplace", sortOrder: 270, exportKey: "marketVisibility" })
];

export const schuldscheinTemplate: TemplateDefinition = {
  type: "schuldschein",
  version: "1.0.0",
  title: "Schuldschein / Darlehensschein",
  subtitle: "Strukturierter Darlehensschein mit Settlement- und Enforcement-Metadaten",
  historicalContext: "Der Schuldschein verbindet Beweisfunktion, Schuldgrund und Zahlungsstruktur.",
  legalIntent: "Belastbare Datenstruktur für Darlehensforderungen inklusive Verzug, Sicherheiten und Vollstreckung.",
  groups: baseTemplateGroups,
  fields,
  clauseBlocks: baseClauseBlocks.filter((clause) => ["rechtswahl", "gerichtsstand", "event_of_default", "mahnverfahren", "kuendigung", "vollstreckungsunterwerfung", "geheimhaltung"].includes(clause.id)),
  validationRules: [
    { type: "dateNotBefore", fieldId: "endfaelligkeit", referenceFieldId: "valutierungsdatum", message: "Endfälligkeit darf nicht vor Valutierungsdatum liegen." },
    { type: "numberRange", fieldId: "zinssatz", min: 0, max: 100, message: "Zinssatz muss zwischen 0 und 100 liegen." },
    { type: "numberRange", fieldId: "verzugszins", min: 0, max: 100, message: "Verzugszins muss zwischen 0 und 100 liegen." },
    { type: "requiredWhen", fieldId: "vollstreckungsunterwerfung", dependsOnFieldId: "notarielleOption", dependsOnComparator: "equals", dependsOnValue: true, message: "Bitte Vollstreckungsunterwerfung explizit festlegen, wenn notarielle Option aktiv ist." }
  ],
  documentRendering: {
    titleFieldId: "dokumententitel",
    partyFieldIds: ["schuldner", "glaeubiger", "mitverpflichtete"],
    summaryFieldIds: ["kapitalbetrag", "waehrung", "zinssatz", "endfaelligkeit"],
    signatureFieldIds: ["schuldner", "glaeubiger"]
  },
  marketplaceMeta: {
    listingTitleField: "dokumententitel",
    summaryFields: ["kapitalbetrag", "waehrung", "zinssatz", "tilgungsmodus", "endfaelligkeit"],
    internalOnlyFields: ["riskMarker", "beweisfunktion", "mahnstufen"],
    ndaProtectedFields: ["anhangsdokumente", "sicherheiten"],
    defaultVisibility: "marketplace"
  },
  riskMeta: {
    riskInputs: ["kapitalbetrag", "zinssatz", "verzugszins", "sicherheiten", "riskMarker"],
    weightings: { kapitalbetrag: 0.2, zinssatz: 0.15, verzugszins: 0.2, sicherheiten: -0.2, riskMarker: 0.25 },
    scoreFormulaHint: "Hohe Verzugszinsen, hohe Markerlast und geringe Sicherheiten erhöhen den Risikoscore.",
    requiresManualReviewWhen: ["riskMarker includes weak-credit", "kapitalbetrag > 1000000"]
  },
  settlementMeta: {
    dueDateFieldIds: ["endfaelligkeit"],
    amountFieldIds: ["kapitalbetrag", "zinssatz", "verzugszins"],
    triggerFieldIds: ["mahnstufen", "vorzeitigeRueckzahlung"],
    eventMapping: {
      maturity: "PAYMENT_DUE",
      installment: "PARTIAL_PAYMENT",
      paid: "PAYMENT_CONFIRMED",
      default: "DEFAULT_TRIGGERED"
    }
  },
  disputeMeta: {
    defaultDisputeType: "CONTRACT_BREACH",
    evidenceFieldIds: ["anhangsdokumente", "beweisfunktion", "schuldgrund"],
    jurisdictionFieldId: "gerichtsstand",
    escalationPath: ["dunning", "mediation", "court_or_arbitration"]
  }
};
