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
  f({ id: "dokumententitel", name: "dokumententitel", label: "Dokumententitel", description: "Formeller Titel des Wechsels.", helpText: "Erscheint im Kopf der Urkunde.", type: "text", required: true, defaultValue: "Wechsel", group: "basisdaten", sortOrder: 10, documentLabel: "Titel", exportKey: "title" }),
  f({ id: "wechselart", name: "wechselart", label: "Wechselart", description: "Handelswechsel, Finanzwechsel oder Sonderform.", type: "select", required: true, options: [{ label: "Handelswechsel", value: "handelswechsel" }, { label: "Finanzwechsel", value: "finanzwechsel" }, { label: "Tratte", value: "tratte" }], group: "basisdaten", sortOrder: 20, exportKey: "type" }),
  f({ id: "aussteller", name: "aussteller", label: "Aussteller", description: "Person oder Organisation, die den Wechsel ausstellt.", type: "partyReference", required: true, group: "parteien", sortOrder: 30, exportKey: "drawer" }),
  f({ id: "bezogener", name: "bezogener", label: "Bezogener", description: "Zur Zahlung angewiesene Partei.", type: "partyReference", required: true, group: "parteien", sortOrder: 40, exportKey: "drawee" }),
  f({ id: "remittent", name: "remittent", label: "Remittent", description: "Erster Zahlungsempfänger des Wechsels.", type: "partyReference", required: true, group: "parteien", sortOrder: 50, exportKey: "payee" }),
  f({ id: "ausstellungsort", name: "ausstellungsort", label: "Ausstellungsort", description: "Ort der Wechselausstellung.", type: "address", required: true, group: "basisdaten", sortOrder: 60, exportKey: "issuePlace" }),
  f({ id: "ausstellungsdatum", name: "ausstellungsdatum", label: "Ausstellungsdatum", description: "Datum der Ausstellung.", type: "date", required: true, group: "basisdaten", sortOrder: 70, exportKey: "issueDate" }),
  f({ id: "zahlungsort", name: "zahlungsort", label: "Zahlungsort", description: "Ort, an dem Zahlung zu leisten ist.", type: "address", required: true, group: "fristen", sortOrder: 80, exportKey: "paymentPlace" }),
  f({ id: "verfalltyp", name: "verfalltyp", label: "Verfalltyp", description: "Art der Fälligkeit des Wechsels.", type: "select", required: true, options: [{ label: "Taggenau", value: "fixed-date" }, { label: "Sicht", value: "at-sight" }, { label: "Nach Sicht", value: "after-sight" }], group: "fristen", sortOrder: 90, exportKey: "maturityType" }),
  f({ id: "verfalltag", name: "verfalltag", label: "Verfalltag", description: "Konkretes Fälligkeitsdatum.", type: "date", required: true, group: "fristen", sortOrder: 100, exportKey: "maturityDate", disputeRelevant: true, obligationType: "payment_due", breachModes: ["late_payment", "non_payment"], relatedSettlementEventTypes: ["PAYMENT_DUE", "PAYMENT_CONFIRMED"], remedyTypes: ["payment_order", "late_fee", "escalation"], severityHint: "warning" }),
  f({ id: "waehrung", name: "waehrung", label: "Währung", description: "Abrechnungswährung.", type: "currency", required: true, defaultValue: "CHF", group: "oekonomik", sortOrder: 110, exportKey: "currency" }),
  f({ id: "betragNumerisch", name: "betragNumerisch", label: "Betrag (numerisch)", description: "Nominalbetrag als Zahl.", type: "number", required: true, validation: [{ type: "min", value: 0.01 }], group: "oekonomik", sortOrder: 120, exportKey: "amountNumeric" }),
  f({ id: "betragAusgeschrieben", name: "betragAusgeschrieben", label: "Betrag (ausgeschrieben)", description: "Nominalbetrag in Worten.", type: "text", required: true, group: "oekonomik", sortOrder: 130, exportKey: "amountText" }),
  f({ id: "teilzahlbarkeit", name: "teilzahlbarkeit", label: "Teilzahlbarkeit", description: "Ob Teilzahlungen zulässig sind.", type: "boolean", defaultValue: false, group: "oekonomik", sortOrder: 140, exportKey: "partialPaymentAllowed" }),
  f({ id: "akzeptErforderlich", name: "akzeptErforderlich", label: "Akzept erforderlich", description: "Ob ein ausdrückliches Akzept des Bezogenen benötigt wird.", type: "boolean", defaultValue: true, group: "fristen", sortOrder: 150, exportKey: "acceptanceRequired" }),
  f({ id: "akzeptdatum", name: "akzeptdatum", label: "Akzeptdatum", description: "Datum des Akzepts durch den Bezogenen.", type: "date", visibility: [{ kind: "field", fieldId: "akzeptErforderlich", comparator: "equals", value: true }], group: "fristen", sortOrder: 160, exportKey: "acceptanceDate" }),
  f({ id: "indossierbar", name: "indossierbar", label: "Indossierbar", description: "Ob der Wechsel durch Indossament übertragbar ist.", type: "boolean", defaultValue: true, group: "marketplace", sortOrder: 170, exportKey: "endorsable" }),
  f({ id: "protestverzicht", name: "protestverzicht", label: "Protestverzicht", description: "Verzicht auf formellen Protest bei Nichtzahlung.", type: "boolean", historical: true, defaultValue: false, group: "historisch", sortOrder: 180, exportKey: "protestWaiver", disputeRelevant: true, obligationType: "procedural_rights", breachModes: ["waiver_dispute"], remedyTypes: ["procedural_reset", "declaratory_relief"], severityHint: "warning" }),
  f({ id: "rueckgriffsklausel", name: "rueckgriffsklausel", label: "Rückgriffsklausel", description: "Regelt Rückgriff auf Vorverpflichtete.", type: "clauseSelector", group: "klauseln", sortOrder: 190, exportKey: "recourseClause" }),
  f({ id: "avalVorhanden", name: "avalVorhanden", label: "Aval vorhanden", description: "Ob ein Aval/Bürge den Wechsel absichert.", type: "boolean", defaultValue: false, group: "sicherheiten", sortOrder: 200, exportKey: "avalPresent", disputeRelevant: true, obligationType: "security_provision", breachModes: ["missing_security"], relatedDocumentTypes: ["aval_certificate"], remedyTypes: ["security_topup", "recourse"], severityHint: "critical" }),
  f({ id: "avalist", name: "avalist", label: "Avalist", description: "Partei, die das Aval übernimmt.", type: "partyReference", visibility: [{ kind: "field", fieldId: "avalVorhanden", comparator: "equals", value: true }], group: "sicherheiten", sortOrder: 210, exportKey: "avalist" }),
  f({ id: "grundgeschaeftReferenz", name: "grundgeschaeftReferenz", label: "Grundgeschäft-Referenz", description: "Interne oder externe Referenz auf das Grundgeschäft.", type: "text", expertOnly: true, visibility: [{ kind: "audience", allowed: ["internal"] }], group: "basisdaten", sortOrder: 220, exportKey: "underlyingReference" }),
  f({ id: "warenbezug", name: "warenbezug", label: "Warenbezug", description: "Beschreibung des Waren- oder Leistungsbezugs.", type: "longText", group: "historisch", sortOrder: 230, historical: true, exportKey: "goodsReference" }),
  f({ id: "finanzierungshintergrund", name: "finanzierungshintergrund", label: "Finanzierungshintergrund", description: "Wirtschaftlicher Zweck der Wechselfinanzierung.", type: "longText", group: "oekonomik", sortOrder: 240, exportKey: "financingContext" }),
  f({ id: "historischeFormel", name: "historischeFormel", label: "Historische Formel", description: "Historisch überlieferte Klauselformulierung.", type: "longText", historical: true, group: "historisch", sortOrder: 250, exportKey: "historicalFormula" }),
  f({ id: "unterschriftsanforderungen", name: "unterschriftsanforderungen", label: "Unterschriftsanforderungen", description: "Signaturregeln für Aussteller, Bezogenen und Avalisten.", type: "structuredObject", group: "dokumente", sortOrder: 260, exportKey: "signatureRequirements" }),
  f({ id: "digitaleSignaturMoeglich", name: "digitaleSignaturMoeglich", label: "Digitale Signatur möglich", description: "Ob qualifizierte digitale Signatur verwendet werden darf.", type: "boolean", defaultValue: true, group: "dokumente", sortOrder: 270, exportKey: "digitalSignatureAllowed" }),
  f({ id: "belege", name: "belege", label: "Belege", description: "Anhänge und Nachweisdokumente.", type: "documentUpload", repeatable: true, visibility: [{ kind: "nda", required: true }], group: "dokumente", sortOrder: 280, exportKey: "attachments" }),
  f({ id: "nichtzahlungsfolgen", name: "nichtzahlungsfolgen", label: "Nichtzahlungsfolgen", description: "Konsequenzen bei Verzug oder Nichterfüllung.", type: "longText", group: "settlement", sortOrder: 290, exportKey: "nonPaymentConsequences" }),
  f({ id: "protestfristen", name: "protestfristen", label: "Protestfristen", description: "Fristen für Protest, Benachrichtigung und Rückgriff.", type: "structuredObject", historical: true, group: "settlement", sortOrder: 300, exportKey: "protestDeadlines" }),
  f({ id: "rechtswahl", name: "rechtswahl", label: "Rechtswahl", description: "Anwendbares materielles Recht.", type: "select", required: true, options: [{ label: "Schweizer OR", value: "CH-OR" }, { label: "Deutsches BGB/HGB", value: "DE-BGB-HGB" }, { label: "Englisches Recht", value: "EN-CommonLaw" }], group: "dispute", sortOrder: 310, exportKey: "governingLaw" }),
  f({ id: "gerichtsstand", name: "gerichtsstand", label: "Gerichtsstand", description: "Gerichtsstand oder Verfahrensort.", type: "text", required: true, group: "dispute", sortOrder: 320, exportKey: "forum" }),
  f({ id: "schiedsoption", name: "schiedsoption", label: "Schiedsoption", description: "Ob Schiedsverfahren statt staatlicher Gerichte vorgesehen ist.", type: "boolean", defaultValue: false, group: "dispute", sortOrder: 330, exportKey: "arbitrationOption" }),
  f({ id: "marktplatzsichtbarkeit", name: "marktplatzsichtbarkeit", label: "Marktplatzsichtbarkeit", description: "Welche Daten im Marketplace sichtbar sind.", type: "select", defaultValue: "summary", options: [{ label: "Nur Summary", value: "summary" }, { label: "Erweitert (NDA)", value: "nda" }, { label: "Intern", value: "internal" }], group: "marketplace", sortOrder: 340, exportKey: "marketVisibility" }),
  f({ id: "uebertragungsregeln", name: "uebertragungsregeln", label: "Übertragungsregeln", description: "Regeln für Indossament, Teilübertragung und Restriktionen.", type: "longText", group: "marketplace", sortOrder: 350, exportKey: "transferRules" })
];

export const wechselTemplate: TemplateDefinition = {
  type: "wechsel",
  version: "1.0.0",
  title: "Wechsel",
  subtitle: "Historisch geprägte Tratte mit moderner Parametrisierung",
  historicalContext: "Der Wechsel diente als zentrales Zahlungs- und Kreditinstrument im Handelsverkehr.",
  legalIntent: "Strukturierte Abbildung einer wechselrechtlichen Zahlungsanweisung inklusive Rückgriffs- und Protestlogik.",
  groups: baseTemplateGroups,
  fields,
  clauseBlocks: baseClauseBlocks.filter((clause) => ["rechtswahl", "gerichtsstand", "schiedsvereinbarung", "protestverzicht", "rueckgriff", "event_of_default", "mahnverfahren", "uebertragbarkeit", "historische_formel"].includes(clause.id)),
  validationRules: [
    { type: "dateNotBefore", fieldId: "verfalltag", referenceFieldId: "ausstellungsdatum", message: "Verfalltag darf nicht vor Ausstellungsdatum liegen." },
    { type: "requiredWhen", fieldId: "avalist", dependsOnFieldId: "avalVorhanden", dependsOnComparator: "equals", dependsOnValue: true, message: "Avalist ist erforderlich, wenn ein Aval vorhanden ist." },
    { type: "requiredWhen", fieldId: "akzeptdatum", dependsOnFieldId: "akzeptErforderlich", dependsOnComparator: "equals", dependsOnValue: true, message: "Akzeptdatum ist erforderlich, wenn Akzept verlangt wird." }
  ],
  documentRendering: {
    titleFieldId: "dokumententitel",
    partyFieldIds: ["aussteller", "bezogener", "remittent", "avalist"],
    summaryFieldIds: ["betragNumerisch", "waehrung", "verfalltag", "zahlungsort"],
    signatureFieldIds: ["unterschriftsanforderungen"]
  },
  marketplaceMeta: {
    listingTitleField: "dokumententitel",
    summaryFields: ["wechselart", "betragNumerisch", "waehrung", "verfalltag"],
    internalOnlyFields: ["grundgeschaeftReferenz", "finanzierungshintergrund"],
    ndaProtectedFields: ["warenbezug", "historischeFormel", "belege"],
    defaultVisibility: "marketplace"
  },
  riskMeta: {
    riskInputs: ["betragNumerisch", "avalVorhanden", "akzeptErforderlich", "nichtzahlungsfolgen", "schiedsoption"],
    weightings: { betragNumerisch: 0.3, avalVorhanden: -0.15, akzeptErforderlich: -0.1, nichtzahlungsfolgen: 0.25, schiedsoption: 0.05 },
    scoreFormulaHint: "Nominalhöhe und Ausfallfolgen erhöhen Risiko, Aval und Akzept senken es.",
    requiresManualReviewWhen: ["betragNumerisch > 500000", "marktplatzsichtbarkeit = nda"]
  },
  settlementMeta: {
    dueDateFieldIds: ["verfalltag"],
    amountFieldIds: ["betragNumerisch"],
    triggerFieldIds: ["akzeptErforderlich", "protestverzicht"],
    eventMapping: {
      maturity: "PAYMENT_DUE",
      paid: "PAYMENT_CONFIRMED",
      partial: "PARTIAL_PAYMENT",
      default: "DEFAULT_TRIGGERED"
    }
  },
  disputeMeta: {
    defaultDisputeType: "NON_PAYMENT",
    evidenceFieldIds: ["belege", "protestfristen", "grundgeschaeftReferenz"],
    jurisdictionFieldId: "gerichtsstand",
    escalationPath: ["direct_notice", "protest_or_waiver", "arbitration_or_court"]
  }
};
