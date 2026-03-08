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
  f({ id: "dokumententitel", name: "dokumententitel", label: "Dokumententitel", description: "Titel der Bürgschaft/Garantie.", type: "text", required: true, defaultValue: "Garantievertrag", group: "basisdaten", sortOrder: 10, exportKey: "title" }),
  f({ id: "hauptschuldner", name: "hauptschuldner", label: "Hauptschuldner", description: "Partei der gesicherten Hauptverbindlichkeit.", type: "partyReference", required: true, group: "parteien", sortOrder: 20, exportKey: "principalDebtor" }),
  f({ id: "buergeOderGarant", name: "buergeOderGarant", label: "Bürge oder Garant", description: "Partei, die Sicherheit stellt.", type: "partyReference", required: true, group: "parteien", sortOrder: 30, exportKey: "guarantor" }),
  f({ id: "beguenstigter", name: "beguenstigter", label: "Begünstigter", description: "Partei, die die Sicherheit abrufen kann.", type: "partyReference", required: true, group: "parteien", sortOrder: 40, exportKey: "beneficiary" }),
  f({ id: "sicherheitsart", name: "sicherheitsart", label: "Sicherheitsart", description: "Bürgschaft, Aval oder abstrakte Garantie.", type: "select", required: true, options: [{ label: "Bürgschaft", value: "surety" }, { label: "Aval", value: "aval" }, { label: "Garantie", value: "guarantee" }], group: "basisdaten", sortOrder: 50, exportKey: "securityType" }),
  f({ id: "subsidiarOderPrimaer", name: "subsidiarOderPrimaer", label: "Subsidiär oder primär", description: "Inanspruchnahme erst nach Hauptschuldner oder direkt.", type: "select", required: true, options: [{ label: "Subsidiär", value: "subsidiary" }, { label: "Primär", value: "primary" }], group: "sicherheiten", sortOrder: 60, exportKey: "liabilityOrder" }),
  f({ id: "hoechstbetrag", name: "hoechstbetrag", label: "Höchstbetrag", description: "Maximale Inanspruchnahme.", type: "number", required: true, validation: [{ type: "min", value: 0.01 }], group: "oekonomik", sortOrder: 70, exportKey: "maxAmount" }),
  f({ id: "waehrung", name: "waehrung", label: "Währung", description: "Währung des Höchstbetrags.", type: "currency", required: true, defaultValue: "CHF", group: "oekonomik", sortOrder: 80, exportKey: "currency" }),
  f({ id: "laufzeit", name: "laufzeit", label: "Laufzeit", description: "Zeitliche Geltung der Sicherheit.", type: "structuredObject", required: true, group: "fristen", sortOrder: 90, exportKey: "term" }),
  f({ id: "bedingungseintritt", name: "bedingungseintritt", label: "Bedingungseintritt", description: "Bedingungen für Abruf / Inanspruchnahme.", type: "longText", required: true, group: "settlement", sortOrder: 100, exportKey: "triggerConditions" }),
  f({ id: "einredenverzicht", name: "einredenverzicht", label: "Einredenverzicht", description: "Verzicht des Bürgen/Garanten auf bestimmte Einreden.", type: "boolean", defaultValue: false, expertOnly: true, group: "klauseln", sortOrder: 110, exportKey: "waiverOfDefenses" }),
  f({ id: "abrufformalitaeten", name: "abrufformalitaeten", label: "Abrufformalitäten", description: "Formale Anforderungen für einen Abruf.", type: "longText", required: true, group: "settlement", sortOrder: 120, exportKey: "callFormalities" }),
  f({ id: "dokumentanforderungen", name: "dokumentanforderungen", label: "Dokumentanforderungen", description: "Erforderliche Nachweise beim Abruf.", type: "documentUpload", repeatable: true, group: "dokumente", sortOrder: 130, exportKey: "callDocuments" }),
  f({ id: "teilinanspruchnahme", name: "teilinanspruchnahme", label: "Teilinanspruchnahme", description: "Ob Teilabrufe erlaubt sind.", type: "boolean", defaultValue: true, group: "settlement", sortOrder: 140, exportKey: "partialCallsAllowed" }),
  f({ id: "regressrechte", name: "regressrechte", label: "Regressrechte", description: "Rückgriff des Garanten gegenüber Hauptschuldner.", type: "longText", group: "sicherheiten", sortOrder: 150, exportKey: "regressRights" }),
  f({ id: "erloeschensgruende", name: "erloeschensgruende", label: "Erlöschensgründe", description: "Tatbestände für das Erlöschen der Sicherheit.", type: "longText", required: true, group: "fristen", sortOrder: 160, exportKey: "extinguishmentCauses" }),
  f({ id: "rechtswahl", name: "rechtswahl", label: "Rechtswahl", description: "Anwendbares Recht.", type: "select", required: true, options: [{ label: "Schweizer Recht", value: "CH" }, { label: "Deutsches Recht", value: "DE" }, { label: "Englisches Recht", value: "EN" }], group: "dispute", sortOrder: 170, exportKey: "governingLaw" }),
  f({ id: "gerichtsstand", name: "gerichtsstand", label: "Gerichtsstand", description: "Forum für Streitbeilegung.", type: "text", required: true, group: "dispute", sortOrder: 180, exportKey: "forum" }),
  f({ id: "marktplatzsichtbarkeit", name: "marktplatzsichtbarkeit", label: "Marktplatzsichtbarkeit", description: "Sichtbarkeit sensibler Sicherungsinformationen.", type: "select", defaultValue: "nda", options: [{ label: "Summary", value: "summary" }, { label: "NDA", value: "nda" }, { label: "Intern", value: "internal" }], group: "marketplace", sortOrder: 190, exportKey: "marketVisibility" })
];

export const garantieTemplate: TemplateDefinition = {
  type: "garantie",
  version: "1.0.0",
  title: "Bürgschaft / Aval / Garantie",
  subtitle: "Sicherungsinstrument mit Abruf- und Regresslogik",
  historicalContext: "Aval und Bürgschaft erweitern die Kreditqualität historischer Handelsinstrumente.",
  legalIntent: "Abbildung von Triggern, Abrufformalitäten, Haftungsgrenzen und Erlöschensgründen.",
  groups: baseTemplateGroups,
  fields,
  clauseBlocks: baseClauseBlocks.filter((clause) => ["rechtswahl", "gerichtsstand", "rueckgriff", "event_of_default", "mahnverfahren", "vollstreckungsunterwerfung", "geheimhaltung"].includes(clause.id)),
  validationRules: [
    { type: "numberRange", fieldId: "hoechstbetrag", min: 0.01, max: 999999999, message: "Höchstbetrag muss positiv sein." }
  ],
  documentRendering: {
    titleFieldId: "dokumententitel",
    partyFieldIds: ["hauptschuldner", "buergeOderGarant", "beguenstigter"],
    summaryFieldIds: ["sicherheitsart", "hoechstbetrag", "subsidiarOderPrimaer", "laufzeit"],
    signatureFieldIds: ["buergeOderGarant", "beguenstigter"]
  },
  marketplaceMeta: {
    listingTitleField: "dokumententitel",
    summaryFields: ["sicherheitsart", "hoechstbetrag", "subsidiarOderPrimaer", "teilinanspruchnahme"],
    internalOnlyFields: ["einredenverzicht", "regressrechte"],
    ndaProtectedFields: ["abrufformalitaeten", "dokumentanforderungen"],
    defaultVisibility: "marketplace"
  },
  riskMeta: {
    riskInputs: ["subsidiarOderPrimaer", "hoechstbetrag", "einredenverzicht", "abrufformalitaeten"],
    weightings: { subsidiarOderPrimaer: 0.2, hoechstbetrag: 0.25, einredenverzicht: 0.15, abrufformalitaeten: -0.1 },
    scoreFormulaHint: "Primäre Haftung und hoher Höchstbetrag erhöhen das Exposure-Risiko.",
    requiresManualReviewWhen: ["sicherheitsart = guarantee", "einredenverzicht = true"]
  },
  settlementMeta: {
    dueDateFieldIds: ["laufzeit"],
    amountFieldIds: ["hoechstbetrag"],
    triggerFieldIds: ["bedingungseintritt", "abrufformalitaeten", "teilinanspruchnahme"],
    eventMapping: { call: "GUARANTOR_TRIGGERED", partialCall: "PARTIAL_PAYMENT", paid: "PAYMENT_CONFIRMED" }
  },
  disputeMeta: {
    defaultDisputeType: "GUARANTOR_DISPUTE",
    evidenceFieldIds: ["dokumentanforderungen", "bedingungseintritt", "abrufformalitaeten"],
    jurisdictionFieldId: "gerichtsstand",
    escalationPath: ["call_notice", "mediation", "court_or_arbitration"]
  }
};
