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
  f({ id: "dokumententitel", name: "dokumententitel", label: "Dokumententitel", description: "Titel des Eigenwechsels.", type: "text", required: true, defaultValue: "Solawechsel", group: "basisdaten", sortOrder: 10, exportKey: "title" }),
  f({ id: "direkterZahlungsversprecher", name: "direkterZahlungsversprecher", label: "Direkter Zahlungsversprecher", description: "Formulierung des unmittelbaren Zahlungsversprechens.", type: "longText", required: true, group: "basisdaten", sortOrder: 20, exportKey: "directPromise" }),
  f({ id: "aussteller", name: "aussteller", label: "Aussteller", description: "Partei, die das Zahlungsversprechen abgibt.", type: "partyReference", required: true, group: "parteien", sortOrder: 30, exportKey: "maker" }),
  f({ id: "remittent", name: "remittent", label: "Remittent", description: "Begünstigter des Zahlungsversprechens.", type: "partyReference", required: true, group: "parteien", sortOrder: 40, exportKey: "payee" }),
  f({ id: "zahlstelle", name: "zahlstelle", label: "Zahlstelle", description: "Ort oder Konto für Zahlungserfüllung.", type: "address", required: true, group: "fristen", sortOrder: 50, exportKey: "paymentPoint" }),
  f({ id: "zahlungsversprechenFormel", name: "zahlungsversprechenFormel", label: "Zahlungsversprechen-Formel", description: "Historisch-formale Wechselformel.", type: "longText", historical: true, group: "historisch", sortOrder: 60, exportKey: "promiseFormula" }),
  f({ id: "waehrung", name: "waehrung", label: "Währung", description: "Währungscode der Forderung.", type: "currency", required: true, defaultValue: "CHF", group: "oekonomik", sortOrder: 70, exportKey: "currency" }),
  f({ id: "betragNumerisch", name: "betragNumerisch", label: "Betrag (numerisch)", description: "Nominalbetrag.", type: "number", required: true, validation: [{ type: "min", value: 0.01 }], group: "oekonomik", sortOrder: 80, exportKey: "amountNumeric" }),
  f({ id: "betragAusgeschrieben", name: "betragAusgeschrieben", label: "Betrag (ausgeschrieben)", description: "Nominalbetrag in Worten.", type: "text", required: true, group: "oekonomik", sortOrder: 90, exportKey: "amountText" }),
  f({ id: "ausstellungsdatum", name: "ausstellungsdatum", label: "Ausstellungsdatum", description: "Datum der Urkunde.", type: "date", required: true, group: "basisdaten", sortOrder: 100, exportKey: "issueDate" }),
  f({ id: "verfalltag", name: "verfalltag", label: "Verfalltag", description: "Tag der Fälligkeit.", type: "date", required: true, group: "fristen", sortOrder: 110, exportKey: "maturityDate" }),
  f({ id: "kuendigungsregeln", name: "kuendigungsregeln", label: "Kündigungsregeln", description: "Regeln für vorzeitige Fälligstellung.", type: "longText", group: "fristen", sortOrder: 120, exportKey: "terminationRules" }),
  f({ id: "vorlageklauseln", name: "vorlageklauseln", label: "Vorlageklauseln", description: "Regeln zur Vorlage des Wechsels bei Fälligkeit.", type: "longText", historical: true, group: "historisch", sortOrder: 130, exportKey: "presentationClauses" }),
  f({ id: "mitschuldner", name: "mitschuldner", label: "Mitschuldner", description: "Zusätzliche verpflichtete Parteien.", type: "partyReference", repeatable: true, group: "sicherheiten", sortOrder: 140, exportKey: "coDebtors" }),
  f({ id: "defaultDefinition", name: "defaultDefinition", label: "Default-Definition", description: "Wann ein Ausfalltatbestand eintritt.", type: "longText", required: true, group: "settlement", sortOrder: 150, exportKey: "defaultDefinition" }),
  f({ id: "rechtswahl", name: "rechtswahl", label: "Rechtswahl", description: "Anwendbares Recht.", type: "select", required: true, options: [{ label: "Schweizer OR", value: "CH-OR" }, { label: "Deutsches Recht", value: "DE" }, { label: "Englisches Recht", value: "EN" }], group: "dispute", sortOrder: 160, exportKey: "governingLaw" }),
  f({ id: "gerichtsstand", name: "gerichtsstand", label: "Gerichtsstand", description: "Gerichtsstand bei Streitfällen.", type: "text", required: true, group: "dispute", sortOrder: 170, exportKey: "forum" }),
  f({ id: "belege", name: "belege", label: "Belege", description: "Nachweisdokumente für Forderungsentstehung und Zahlung.", type: "documentUpload", repeatable: true, visibility: [{ kind: "nda", required: true }], group: "dokumente", sortOrder: 180, exportKey: "attachments" }),
  f({ id: "marktplatzsichtbarkeit", name: "marktplatzsichtbarkeit", label: "Marktplatzsichtbarkeit", description: "Transparenzgrad im Marketplace.", type: "select", defaultValue: "summary", options: [{ label: "Summary", value: "summary" }, { label: "NDA", value: "nda" }, { label: "Intern", value: "internal" }], group: "marketplace", sortOrder: 190, exportKey: "marketVisibility" })
];

export const solawechselTemplate: TemplateDefinition = {
  type: "solawechsel",
  version: "1.0.0",
  title: "Solawechsel / Eigenwechsel",
  subtitle: "Direktes Zahlungsversprechen ohne Bezogenen",
  historicalContext: "Der Eigenwechsel verankert das direkte Zahlungsversprechen des Ausstellers.",
  legalIntent: "Abbildung eines promissory-note-nahen Instruments mit wechselrechtlicher Struktur.",
  groups: baseTemplateGroups,
  fields,
  clauseBlocks: baseClauseBlocks.filter((clause) => ["rechtswahl", "gerichtsstand", "event_of_default", "mahnverfahren", "uebertragbarkeit", "historische_formel"].includes(clause.id)),
  validationRules: [
    { type: "dateNotBefore", fieldId: "verfalltag", referenceFieldId: "ausstellungsdatum", message: "Verfalltag darf nicht vor Ausstellungsdatum liegen." }
  ],
  documentRendering: {
    titleFieldId: "dokumententitel",
    partyFieldIds: ["aussteller", "remittent", "mitschuldner"],
    summaryFieldIds: ["betragNumerisch", "waehrung", "verfalltag"],
    signatureFieldIds: ["aussteller"]
  },
  marketplaceMeta: {
    listingTitleField: "dokumententitel",
    summaryFields: ["betragNumerisch", "waehrung", "verfalltag", "defaultDefinition"],
    internalOnlyFields: ["kuendigungsregeln"],
    ndaProtectedFields: ["vorlageklauseln", "belege"],
    defaultVisibility: "marketplace"
  },
  riskMeta: {
    riskInputs: ["betragNumerisch", "defaultDefinition", "mitschuldner"],
    weightings: { betragNumerisch: 0.35, defaultDefinition: 0.35, mitschuldner: -0.1 },
    scoreFormulaHint: "Klarheit der Default-Definition und zusätzliche Mitschuldner beeinflussen Risiko maßgeblich.",
    requiresManualReviewWhen: ["betragNumerisch > 250000"]
  },
  settlementMeta: {
    dueDateFieldIds: ["verfalltag"],
    amountFieldIds: ["betragNumerisch"],
    triggerFieldIds: ["defaultDefinition"],
    eventMapping: { maturity: "PAYMENT_DUE", paid: "PAYMENT_CONFIRMED", default: "DEFAULT_TRIGGERED" }
  },
  disputeMeta: {
    defaultDisputeType: "NON_PAYMENT",
    evidenceFieldIds: ["belege", "vorlageklauseln", "direkterZahlungsversprecher"],
    jurisdictionFieldId: "gerichtsstand",
    escalationPath: ["notice", "collection", "court_or_arbitration"]
  }
};
