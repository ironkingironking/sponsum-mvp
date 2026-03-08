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
  f({ id: "dokumententitel", name: "dokumententitel", label: "Dokumententitel", description: "Titel der Gült/Rentenbrief-Struktur.", type: "text", required: true, defaultValue: "Gültvertrag", group: "basisdaten", sortOrder: 10, exportKey: "title" }),
  f({ id: "rentenglaeubiger", name: "rentenglaeubiger", label: "Rentengläubiger", description: "Berechtigter der Rentenzahlungen.", type: "partyReference", required: true, group: "parteien", sortOrder: 20, exportKey: "annuityCreditor" }),
  f({ id: "verpflichteter", name: "verpflichteter", label: "Verpflichteter", description: "Leistungspflichtige Partei.", type: "partyReference", required: true, group: "parteien", sortOrder: 30, exportKey: "obligor" }),
  f({ id: "belastetesObjekt", name: "belastetesObjekt", label: "Belastetes Objekt", description: "Grundstück oder Vermögensobjekt, das belastet wird.", type: "text", required: true, group: "sicherheiten", sortOrder: 40, exportKey: "encumberedAsset" }),
  f({ id: "objektbeschreibung", name: "objektbeschreibung", label: "Objektbeschreibung", description: "Detaillierte Beschreibung des belasteten Objekts.", type: "longText", required: true, group: "sicherheiten", sortOrder: 50, exportKey: "assetDescription" }),
  f({ id: "kapitalbetrag", name: "kapitalbetrag", label: "Kapitalbetrag", description: "Kapitalwert der Rentenverpflichtung.", type: "number", required: true, validation: [{ type: "min", value: 0.01 }], group: "oekonomik", sortOrder: 60, exportKey: "capitalAmount" }),
  f({ id: "waehrung", name: "waehrung", label: "Währung", description: "Währung der Rentenleistung.", type: "currency", required: true, defaultValue: "CHF", group: "oekonomik", sortOrder: 70, exportKey: "currency" }),
  f({ id: "rentenart", name: "rentenart", label: "Rentenart", description: "Fixe Rente, ertragsabhängig oder gemischt.", type: "select", required: true, options: [{ label: "Fix", value: "fixed" }, { label: "Ertragsabhängig", value: "yield-linked" }, { label: "Hybrid", value: "hybrid" }], group: "oekonomik", sortOrder: 80, exportKey: "annuityType" }),
  f({ id: "rentenhoehe", name: "rentenhoehe", label: "Rentenhöhe", description: "Periodische Zahlungshöhe.", type: "number", required: true, validation: [{ type: "min", value: 0 }], group: "oekonomik", sortOrder: 90, exportKey: "annuityAmount" }),
  f({ id: "zahlungstermine", name: "zahlungstermine", label: "Zahlungstermine", description: "Terminplan der Rentenzahlungen.", type: "structuredObject", required: true, group: "fristen", sortOrder: 100, exportKey: "paymentSchedule", disputeRelevant: true, obligationType: "annuity_payment_due", breachModes: ["late_payment", "non_payment"], relatedSettlementEventTypes: ["PAYMENT_DUE", "PAYMENT_CONFIRMED"], remedyTypes: ["payment_order", "default_notice"], severityHint: "warning" }),
  f({ id: "abloesbarkeit", name: "abloesbarkeit", label: "Ablösbarkeit", description: "Ob und wie die Rente abgelöst werden kann.", type: "boolean", defaultValue: true, group: "fristen", sortOrder: 110, exportKey: "redeemable" }),
  f({ id: "abloesesumme", name: "abloesesumme", label: "Ablösesumme", description: "Summe bei vorzeitiger Ablösung.", type: "number", visibility: [{ kind: "field", fieldId: "abloesbarkeit", comparator: "equals", value: true }], validation: [{ type: "min", value: 0 }], group: "fristen", sortOrder: 120, exportKey: "redemptionAmount" }),
  f({ id: "dinglicherCharakter", name: "dinglicherCharakter", label: "Dinglicher Charakter", description: "Beschreibung der dinglichen Einordnung.", type: "longText", historical: true, group: "historisch", sortOrder: 130, exportKey: "inRemCharacter" }),
  f({ id: "rangstelle", name: "rangstelle", label: "Rangstelle", description: "Rang im Belastungs- oder Hypothekenregister.", type: "text", required: true, group: "sicherheiten", sortOrder: 140, exportKey: "priorityRank" }),
  f({ id: "ertragsquelle", name: "ertragsquelle", label: "Ertragsquelle", description: "Primäre Quelle für Rentenzahlungen.", type: "longText", group: "oekonomik", sortOrder: 150, exportKey: "incomeSource" }),
  f({ id: "pfandcharakter", name: "pfandcharakter", label: "Pfandcharakter", description: "Pfandrechtliche Ausgestaltung des Instruments.", type: "longText", group: "sicherheiten", sortOrder: 160, exportKey: "pledgeNature" }),
  f({ id: "eigentumsreferenz", name: "eigentumsreferenz", label: "Eigentumsreferenz", description: "Referenz auf Eigentumsnachweise / Registereintrag.", type: "text", expertOnly: true, group: "dokumente", sortOrder: 170, exportKey: "ownershipReference" }),
  f({ id: "urkundenhinweise", name: "urkundenhinweise", label: "Urkundenhinweise", description: "Form- und Urkundenhinweise für Vollzug.", type: "longText", historical: true, group: "historisch", sortOrder: 180, exportKey: "deedNotes" }),
  f({ id: "notarinfo", name: "notarinfo", label: "Notarinfo", description: "Notariat, Urkundenrolle, Beurkundungsdaten.", type: "structuredObject", group: "dokumente", sortOrder: 190, exportKey: "notaryInfo" }),
  f({ id: "historischeKlauseln", name: "historischeKlauseln", label: "Historische Klauseln", description: "Historisch übernommene Klauselfragmente.", type: "longText", historical: true, group: "historisch", sortOrder: 200, exportKey: "historicalClauses" }),
  f({ id: "zahlungsversaeumnisfolgen", name: "zahlungsversaeumnisfolgen", label: "Zahlungsversäumnisfolgen", description: "Konsequenzen bei ausbleibender Rentenzahlung.", type: "longText", required: true, group: "settlement", sortOrder: 210, exportKey: "missedPaymentConsequences" }),
  f({ id: "uebertragbarkeitGlaeubigerposition", name: "uebertragbarkeitGlaeubigerposition", label: "Übertragbarkeit Gläubigerposition", description: "Regeln zur Übertragung der Rentengläubigerposition.", type: "longText", group: "marketplace", sortOrder: 220, exportKey: "creditorTransferability" }),
  f({ id: "rechtswahl", name: "rechtswahl", label: "Rechtswahl", description: "Anwendbares Recht.", type: "select", required: true, options: [{ label: "Schweizer Recht", value: "CH" }, { label: "Deutsches Recht", value: "DE" }], group: "dispute", sortOrder: 230, exportKey: "governingLaw" }),
  f({ id: "gerichtsstand", name: "gerichtsstand", label: "Gerichtsstand", description: "Gerichtsstand oder Schiedsforum.", type: "text", required: true, group: "dispute", sortOrder: 240, exportKey: "forum" }),
  f({ id: "marktplatzsichtbarkeit", name: "marktplatzsichtbarkeit", label: "Marktplatzsichtbarkeit", description: "Sichtbarkeit für Investoren und Käufer.", type: "select", defaultValue: "nda", options: [{ label: "Summary", value: "summary" }, { label: "NDA", value: "nda" }, { label: "Intern", value: "internal" }], group: "marketplace", sortOrder: 250, exportKey: "marketVisibility" })
];

export const gueltTemplate: TemplateDefinition = {
  type: "guelt",
  version: "1.0.0",
  title: "Gült / Rentenbriefartige Struktur",
  subtitle: "Dinglich geprägtes Renteninstrument mit Ablöselogik",
  historicalContext: "Gült-ähnliche Strukturen koppeln Rentenansprüche an belastete Vermögenswerte.",
  legalIntent: "Abbildung von Rentenzahlungsrechten mit Rang- und Objektbezug, inklusive Ablösungs- und Durchsetzungsregeln.",
  groups: baseTemplateGroups,
  fields,
  clauseBlocks: baseClauseBlocks.filter((clause) => ["rechtswahl", "gerichtsstand", "schiedsvereinbarung", "event_of_default", "uebertragbarkeit", "historische_formel", "geheimhaltung"].includes(clause.id)),
  validationRules: [
    { type: "numberRange", fieldId: "abloesesumme", min: 0, max: 999999999, message: "Ablösesumme darf nicht negativ sein." },
    { type: "requiredWhen", fieldId: "abloesesumme", dependsOnFieldId: "abloesbarkeit", dependsOnComparator: "equals", dependsOnValue: true, message: "Ablösesumme erforderlich, wenn Ablösbarkeit aktiviert ist." }
  ],
  documentRendering: {
    titleFieldId: "dokumententitel",
    partyFieldIds: ["rentenglaeubiger", "verpflichteter"],
    summaryFieldIds: ["kapitalbetrag", "rentenhoehe", "zahlungstermine", "rangstelle"],
    signatureFieldIds: ["notarinfo"]
  },
  marketplaceMeta: {
    listingTitleField: "dokumententitel",
    summaryFields: ["rentenart", "rentenhoehe", "belastetesObjekt", "rangstelle"],
    internalOnlyFields: ["eigentumsreferenz", "notarinfo"],
    ndaProtectedFields: ["objektbeschreibung", "historischeKlauseln", "urkundenhinweise"],
    defaultVisibility: "marketplace"
  },
  riskMeta: {
    riskInputs: ["rangstelle", "ertragsquelle", "abloesbarkeit", "zahlungsversaeumnisfolgen"],
    weightings: { rangstelle: 0.25, ertragsquelle: 0.2, abloesbarkeit: 0.1, zahlungsversaeumnisfolgen: 0.25 },
    scoreFormulaHint: "Niedrige Rangstelle, unsichere Ertragsquelle und harte Ausfallfolgen erhöhen Risiko.",
    requiresManualReviewWhen: ["rangstelle contains 'nachrangig'", "marktplatzsichtbarkeit = internal"]
  },
  settlementMeta: {
    dueDateFieldIds: ["zahlungstermine"],
    amountFieldIds: ["rentenhoehe", "kapitalbetrag", "abloesesumme"],
    triggerFieldIds: ["abloesbarkeit", "zahlungsversaeumnisfolgen"],
    eventMapping: { due: "PAYMENT_DUE", annuityPaid: "PAYMENT_CONFIRMED", default: "DEFAULT_TRIGGERED" }
  },
  disputeMeta: {
    defaultDisputeType: "CONTRACT_BREACH",
    evidenceFieldIds: ["urkundenhinweise", "notarinfo", "eigentumsreferenz"],
    jurisdictionFieldId: "gerichtsstand",
    escalationPath: ["notice", "mediation", "land_register_or_court"]
  }
};
