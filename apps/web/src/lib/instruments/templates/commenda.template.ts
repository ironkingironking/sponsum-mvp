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
  f({ id: "dokumententitel", name: "dokumententitel", label: "Dokumententitel", description: "Titel der Commenda-Struktur.", type: "text", required: true, defaultValue: "Commenda-Vertrag", group: "basisdaten", sortOrder: 10, exportKey: "title" }),
  f({ id: "kapitalgeber", name: "kapitalgeber", label: "Kapitalgeber", description: "Investor / Kapitalgeber.", type: "partyReference", required: true, group: "parteien", sortOrder: 20, exportKey: "capitalProvider" }),
  f({ id: "operativerPartner", name: "operativerPartner", label: "Operativer Partner", description: "Handelsführende Partei.", type: "partyReference", required: true, group: "parteien", sortOrder: 30, exportKey: "operatingPartner" }),
  f({ id: "zweck", name: "zweck", label: "Zweck", description: "Primärer Vertragszweck.", type: "text", required: true, group: "basisdaten", sortOrder: 40, exportKey: "purpose" }),
  f({ id: "projektbeschreibung", name: "projektbeschreibung", label: "Projektbeschreibung", description: "Umfangreiche Beschreibung des Vorhabens.", type: "longText", required: true, group: "basisdaten", sortOrder: 50, exportKey: "projectDescription" }),
  f({ id: "laufzeit", name: "laufzeit", label: "Laufzeit", description: "Vertragslaufzeit oder erwartete Projektdauer.", type: "structuredObject", required: true, group: "fristen", sortOrder: 60, exportKey: "term" }),
  f({ id: "einlage", name: "einlage", label: "Einlage", description: "Kapitaleinlage des Investors.", type: "number", required: true, validation: [{ type: "min", value: 0.01 }], group: "oekonomik", sortOrder: 70, exportKey: "capitalContribution" }),
  f({ id: "waehrung", name: "waehrung", label: "Währung", description: "Währung der Einlage und Ausschüttung.", type: "currency", required: true, defaultValue: "CHF", group: "oekonomik", sortOrder: 80, exportKey: "currency" }),
  f({ id: "gewinnverteilung", name: "gewinnverteilung", label: "Gewinnverteilung", description: "Verteilungsregel für Gewinne.", type: "structuredObject", required: true, group: "oekonomik", sortOrder: 90, exportKey: "profitShare" }),
  f({ id: "verlusttragung", name: "verlusttragung", label: "Verlusttragung", description: "Regelung zur Verlustzuweisung.", type: "structuredObject", required: true, group: "oekonomik", sortOrder: 100, exportKey: "lossAllocation" }),
  f({ id: "haftungsgrenzen", name: "haftungsgrenzen", label: "Haftungsgrenzen", description: "Haftungslimits für Beteiligte.", type: "structuredObject", group: "sicherheiten", sortOrder: 110, exportKey: "liabilityCaps" }),
  f({ id: "erlaubteGeschaefte", name: "erlaubteGeschaefte", label: "Erlaubte Geschäfte", description: "Positivliste zulässiger Aktivitäten.", type: "longText", required: true, group: "basisdaten", sortOrder: 120, exportKey: "allowedBusiness" }),
  f({ id: "ausgeschlosseneGeschaefte", name: "ausgeschlosseneGeschaefte", label: "Ausgeschlossene Geschäfte", description: "Negativliste verbotener Aktivitäten.", type: "longText", group: "basisdaten", sortOrder: 130, exportKey: "excludedBusiness" }),
  f({ id: "reportingpflichten", name: "reportingpflichten", label: "Reportingpflichten", description: "Inhalt und Rhythmus der Berichte.", type: "structuredObject", required: true, group: "settlement", sortOrder: 140, exportKey: "reportingDuties", disputeRelevant: true, obligationType: "reporting_obligation", breachModes: ["reporting_missing", "reporting_incomplete"], relatedDocumentTypes: ["reporting_statement"], remedyTypes: ["information_order", "penalty", "termination_option"], severityHint: "warning" }),
  f({ id: "rechenschaftslegung", name: "rechenschaftslegung", label: "Rechenschaftslegung", description: "Regeln zur Rechnungslegung und Prüfrechten.", type: "longText", group: "settlement", sortOrder: 150, exportKey: "accountability" }),
  f({ id: "zwischenabrechnungen", name: "zwischenabrechnungen", label: "Zwischenabrechnungen", description: "Regeln für Interimsabrechnungen.", type: "structuredObject", group: "settlement", sortOrder: 160, exportKey: "interimStatements" }),
  f({ id: "exitRegeln", name: "exitRegeln", label: "Exit-Regeln", description: "Ausstieg, Anteilsverkauf und Laufzeitende.", type: "longText", required: true, group: "fristen", sortOrder: 170, exportKey: "exitRules" }),
  f({ id: "kapitalrueckfuehrung", name: "kapitalrueckfuehrung", label: "Kapitalrückführung", description: "Mechanik der Kapitalrückführung.", type: "longText", required: true, group: "settlement", sortOrder: 180, exportKey: "capitalReturn" }),
  f({ id: "treuepflichten", name: "treuepflichten", label: "Treuepflichten", description: "Loyalitäts- und Interessenkonfliktregeln.", type: "longText", group: "klauseln", sortOrder: 190, exportKey: "fiduciaryDuties" }),
  f({ id: "custody", name: "custody", label: "Custody", description: "Verwahrung von Dokumenten, Tokens oder Assets.", type: "structuredObject", group: "sicherheiten", sortOrder: 200, exportKey: "custodyArrangement" }),
  f({ id: "pflichtverletzungen", name: "pflichtverletzungen", label: "Pflichtverletzungen", description: "Definition wesentlicher Pflichtverletzungen.", type: "longText", required: true, group: "dispute", sortOrder: 210, exportKey: "breachDefinitions" }),
  f({ id: "disputeMechanik", name: "disputeMechanik", label: "Dispute-Mechanik", description: "Mediation, Schiedsverfahren, gerichtliche Eskalation.", type: "structuredObject", required: true, group: "dispute", sortOrder: 220, exportKey: "disputeMechanism" }),
  f({ id: "historischePlausibilitaetsklauseln", name: "historischePlausibilitaetsklauseln", label: "Historische Plausibilitätsklauseln", description: "Historisch inspirierte, modern interpretierte Klauseln.", type: "longText", historical: true, group: "historisch", sortOrder: 230, exportKey: "historicalPlausibilityClauses" }),
  f({ id: "investorenMetadaten", name: "investorenMetadaten", label: "Investoren-Metadaten", description: "Interne Anlegerklassifizierung, Ticketgrößen, Restriktionen.", type: "structuredObject", expertOnly: true, visibility: [{ kind: "audience", allowed: ["internal"] }], group: "marketplace", sortOrder: 240, exportKey: "investorMetadata" }),
  f({ id: "belege", name: "belege", label: "Dokumente", description: "Due-Diligence- und Projektunterlagen.", type: "documentUpload", repeatable: true, group: "dokumente", sortOrder: 250, exportKey: "attachments" }),
  f({ id: "rechtswahl", name: "rechtswahl", label: "Rechtswahl", description: "Anwendbares Recht.", type: "select", required: true, options: [{ label: "Schweizer Recht", value: "CH" }, { label: "Englisches Recht", value: "EN" }, { label: "Luxemburgisches Recht", value: "LU" }], group: "dispute", sortOrder: 260, exportKey: "governingLaw" }),
  f({ id: "gerichtsstand", name: "gerichtsstand", label: "Gerichtsstand", description: "Forum für Streitbeilegung.", type: "text", required: true, group: "dispute", sortOrder: 270, exportKey: "forum" }),
  f({ id: "marktplatzsichtbarkeit", name: "marktplatzsichtbarkeit", label: "Marktplatzsichtbarkeit", description: "Welche Daten Investoren sehen.", type: "select", defaultValue: "nda", options: [{ label: "Summary", value: "summary" }, { label: "NDA", value: "nda" }, { label: "Intern", value: "internal" }], group: "marketplace", sortOrder: 280, exportKey: "marketVisibility" })
];

export const commendaTemplate: TemplateDefinition = {
  type: "commenda",
  version: "1.0.0",
  title: "Commenda / kommanditaähnliche Beteiligung",
  subtitle: "Historisch inspirierte Venture-Finanzierung mit moderner Governance",
  historicalContext: "Die Commenda trennte Kapitalbereitstellung und operative Handelsführung.",
  legalIntent: "Modellierung von Beteiligungsverhältnissen, Gewinn-/Verlustregeln, Reporting und Exit-Mechaniken.",
  groups: baseTemplateGroups,
  fields,
  clauseBlocks: baseClauseBlocks.filter((clause) => ["rechtswahl", "gerichtsstand", "schiedsvereinbarung", "reportingpflicht", "event_of_default", "kuendigung", "geheimhaltung", "historische_formel"].includes(clause.id)),
  validationRules: [
    { type: "numberRange", fieldId: "einlage", min: 0.01, max: 999999999, message: "Einlage muss positiv sein." }
  ],
  documentRendering: {
    titleFieldId: "dokumententitel",
    partyFieldIds: ["kapitalgeber", "operativerPartner"],
    summaryFieldIds: ["einlage", "waehrung", "gewinnverteilung", "laufzeit"],
    signatureFieldIds: ["kapitalgeber", "operativerPartner"]
  },
  marketplaceMeta: {
    listingTitleField: "dokumententitel",
    summaryFields: ["zweck", "einlage", "gewinnverteilung", "exitRegeln"],
    internalOnlyFields: ["investorenMetadaten", "ausgeschlosseneGeschaefte"],
    ndaProtectedFields: ["projektbeschreibung", "reportingpflichten", "belege"],
    defaultVisibility: "marketplace"
  },
  riskMeta: {
    riskInputs: ["verlusttragung", "haftungsgrenzen", "pflichtverletzungen", "reportingpflichten"],
    weightings: { verlusttragung: 0.25, haftungsgrenzen: 0.15, pflichtverletzungen: 0.3, reportingpflichten: -0.1 },
    scoreFormulaHint: "Unklare Pflichtverletzungs- und Verlustregeln erhöhen den Risikoscore.",
    requiresManualReviewWhen: ["investorenMetadaten indicates restricted investors", "custody missing"]
  },
  settlementMeta: {
    dueDateFieldIds: ["laufzeit", "zwischenabrechnungen"],
    amountFieldIds: ["einlage", "gewinnverteilung", "kapitalrueckfuehrung"],
    triggerFieldIds: ["exitRegeln", "pflichtverletzungen"],
    eventMapping: { interim: "PARTIAL_PAYMENT", finalReturn: "PAYMENT_CONFIRMED", breach: "DEFAULT_TRIGGERED" }
  },
  disputeMeta: {
    defaultDisputeType: "PROFIT_SHARE_DISPUTE",
    evidenceFieldIds: ["reportingpflichten", "zwischenabrechnungen", "belege"],
    jurisdictionFieldId: "gerichtsstand",
    escalationPath: ["information_request", "mediation", "arbitration_or_court"]
  }
};
