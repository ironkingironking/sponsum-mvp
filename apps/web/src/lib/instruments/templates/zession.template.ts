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
  f({ id: "dokumententitel", name: "dokumententitel", label: "Dokumententitel", description: "Titel der Zessionsvereinbarung.", type: "text", required: true, defaultValue: "Zessionsvertrag", group: "basisdaten", sortOrder: 10, exportKey: "title" }),
  f({ id: "zedent", name: "zedent", label: "Zedent", description: "Abtretender Forderungsinhaber.", type: "partyReference", required: true, group: "parteien", sortOrder: 20, exportKey: "assignor" }),
  f({ id: "zessionar", name: "zessionar", label: "Zessionar", description: "Erwerber der Forderung.", type: "partyReference", required: true, group: "parteien", sortOrder: 30, exportKey: "assignee" }),
  f({ id: "drittschuldner", name: "drittschuldner", label: "Drittschuldner", description: "Originärer Schuldner der Forderung.", type: "partyReference", required: true, group: "parteien", sortOrder: 40, exportKey: "thirdPartyDebtor" }),
  f({ id: "grundgeschaeft", name: "grundgeschaeft", label: "Grundgeschäft", description: "Beschreibung der zugrunde liegenden Forderung.", type: "longText", required: true, group: "basisdaten", sortOrder: 50, exportKey: "underlyingTransaction" }),
  f({ id: "abtretungsdatum", name: "abtretungsdatum", label: "Abtretungsdatum", description: "Datum des Forderungsübergangs.", type: "date", required: true, group: "basisdaten", sortOrder: 55, exportKey: "assignmentDate" }),
  f({ id: "nominalwert", name: "nominalwert", label: "Nominalwert", description: "Nominalwert der abgetretenen Forderung.", type: "number", required: true, validation: [{ type: "min", value: 0.01 }], group: "oekonomik", sortOrder: 60, exportKey: "nominalValue" }),
  f({ id: "kaufpreis", name: "kaufpreis", label: "Kaufpreis", description: "Tatsächlicher Kaufpreis der Forderung.", type: "number", required: true, validation: [{ type: "min", value: 0 }], group: "oekonomik", sortOrder: 70, exportKey: "purchasePrice" }),
  f({ id: "kaufpreisBegruendung", name: "kaufpreisBegruendung", label: "Begründung Kaufpreisaufschlag", description: "Begründung, wenn Kaufpreis den Nominalwert übersteigt.", type: "longText", expertOnly: true, visibility: [{ kind: "audience", allowed: ["internal"] }], group: "oekonomik", sortOrder: 75, exportKey: "purchasePriceRationale" }),
  f({ id: "diskont", name: "diskont", label: "Diskont (%)", description: "Abschlag zum Nominalwert.", type: "percent", validation: [{ type: "min", value: 0 }, { type: "max", value: 100 }], group: "oekonomik", sortOrder: 80, exportKey: "discount" }),
  f({ id: "offeneOderStilleZession", name: "offeneOderStilleZession", label: "Offene oder stille Zession", description: "Ob Drittschuldner informiert wird.", type: "select", required: true, options: [{ label: "Offen", value: "offen" }, { label: "Still", value: "still" }], group: "marketplace", sortOrder: 90, exportKey: "cessionMode" }),
  f({ id: "benachrichtigungDrittschuldner", name: "benachrichtigungDrittschuldner", label: "Benachrichtigung Drittschuldner", description: "Regeln der Benachrichtigung.", type: "longText", visibility: [{ kind: "field", fieldId: "offeneOderStilleZession", comparator: "equals", value: "offen" }], group: "fristen", sortOrder: 100, exportKey: "debtorNotification", disputeRelevant: true, obligationType: "notification_obligation", breachModes: ["notification_missing"], relatedDocumentTypes: ["assignment_document"], remedyTypes: ["notice_cure", "damages"], severityHint: "warning" }),
  f({ id: "rueckgriffsrechte", name: "rueckgriffsrechte", label: "Rückgriffsrechte", description: "Regelung des Rückgriffs auf den Zedenten.", type: "longText", group: "sicherheiten", sortOrder: 110, exportKey: "recourseRights" }),
  f({ id: "gewaerleistungBestand", name: "gewaerleistungBestand", label: "Gewährleistung Bestand", description: "Gewährleistung für rechtlichen Bestand der Forderung.", type: "boolean", defaultValue: true, group: "sicherheiten", sortOrder: 120, exportKey: "warrantyExistence", disputeRelevant: true, obligationType: "receivable_validity", breachModes: ["warranty_dispute", "misrepresentation"], relatedDocumentTypes: ["assignment_document", "origin_document"], remedyTypes: ["recourse", "rescission", "indemnity"], severityHint: "critical" }),
  f({ id: "gewaerleistungEinbringlichkeit", name: "gewaerleistungEinbringlichkeit", label: "Gewährleistung Einbringlichkeit", description: "Gewährleistung für wirtschaftliche Einbringlichkeit.", type: "boolean", defaultValue: false, group: "sicherheiten", sortOrder: 130, exportKey: "warrantyCollectability" }),
  f({ id: "teilabtretung", name: "teilabtretung", label: "Teilabtretung", description: "Ob Teilabtretung zulässig ist.", type: "boolean", defaultValue: false, group: "marketplace", sortOrder: 140, exportKey: "partialAssignment" }),
  f({ id: "prioritaetsregeln", name: "prioritaetsregeln", label: "Prioritätsregeln", description: "Rangfolge bei mehrfacher Abtretung.", type: "longText", required: true, group: "marketplace", sortOrder: 150, exportKey: "priorityRules" }),
  f({ id: "dokumentnachweise", name: "dokumentnachweise", label: "Dokumentnachweise", description: "Nachweise zur Forderung und Abtretung.", type: "documentUpload", repeatable: true, required: true, group: "dokumente", sortOrder: 160, exportKey: "evidenceDocuments", disputeRelevant: true, obligationType: "document_delivery", breachModes: ["required_document_missing", "uploaded_document_inconsistent"], relatedDocumentTypes: ["assignment_document", "origin_document"], remedyTypes: ["document_cure", "suspension"], severityHint: "warning" }),
  f({ id: "ursprungsfaelligkeit", name: "ursprungsfaelligkeit", label: "Ursprungsfälligkeit", description: "Fälligkeit der Ursprungsforderung.", type: "date", required: true, group: "fristen", sortOrder: 170, exportKey: "originalDueDate" }),
  f({ id: "inkassoDurch", name: "inkassoDurch", label: "Inkasso durch", description: "Welche Partei das Inkasso übernimmt.", type: "select", required: true, options: [{ label: "Zedent", value: "zedent" }, { label: "Zessionar", value: "zessionar" }, { label: "Servicer", value: "servicer" }], group: "settlement", sortOrder: 180, exportKey: "collectionBy" }),
  f({ id: "streitfallGrundgeschaeft", name: "streitfallGrundgeschaeft", label: "Streitfall Grundgeschäft", description: "Vorgehen bei Einwendungen aus dem Grundgeschäft.", type: "longText", group: "dispute", sortOrder: 190, exportKey: "underlyingDisputeHandling" }),
  f({ id: "rueckabwicklung", name: "rueckabwicklung", label: "Rückabwicklung", description: "Mechanik bei Unwirksamkeit oder Leistungsstörung.", type: "longText", group: "settlement", sortOrder: 200, exportKey: "unwindMechanism" }),
  f({ id: "rechtswahl", name: "rechtswahl", label: "Rechtswahl", description: "Anwendbares Recht.", type: "select", required: true, options: [{ label: "Schweizer Recht", value: "CH" }, { label: "Deutsches Recht", value: "DE" }, { label: "Englisches Recht", value: "EN" }], group: "dispute", sortOrder: 210, exportKey: "governingLaw" }),
  f({ id: "gerichtsstand", name: "gerichtsstand", label: "Gerichtsstand", description: "Gerichtsstand / Schiedsforum.", type: "text", required: true, group: "dispute", sortOrder: 220, exportKey: "forum" }),
  f({ id: "marktplatzsichtbarkeit", name: "marktplatzsichtbarkeit", label: "Marktplatzsichtbarkeit", description: "Datenfreigabe im Marketplace.", type: "select", defaultValue: "nda", options: [{ label: "Summary", value: "summary" }, { label: "NDA", value: "nda" }, { label: "Intern", value: "internal" }], group: "marketplace", sortOrder: 230, exportKey: "marketVisibility" })
];

export const zessionTemplate: TemplateDefinition = {
  type: "zession",
  version: "1.0.0",
  title: "Zession / Forderungsabtretung",
  subtitle: "Forderungsübertragung mit Factoring-naher Parametrik",
  historicalContext: "Die Zession strukturiert den Forderungsübergang zwischen Zedent und Zessionar.",
  legalIntent: "Abbildung von Abtretungsmodus, Gewährleistungen, Priorität und Inkasso-/Rückabwicklungslogik.",
  groups: baseTemplateGroups,
  fields,
  clauseBlocks: baseClauseBlocks.filter((clause) => ["rechtswahl", "gerichtsstand", "rueckgriff", "event_of_default", "uebertragbarkeit", "geheimhaltung", "mahnverfahren"].includes(clause.id)),
  validationRules: [
    { type: "dateNotBefore", fieldId: "ursprungsfaelligkeit", referenceFieldId: "abtretungsdatum", message: "Ursprungsfälligkeit darf nicht vor Abtretungsdatum liegen." },
    { type: "numberRange", fieldId: "diskont", min: 0, max: 100, message: "Diskont muss zwischen 0 und 100 liegen." },
    { type: "numberNotAbove", fieldId: "kaufpreis", referenceFieldId: "nominalwert", justificationFieldId: "kaufpreisBegruendung", message: "Kaufpreis darf Nominalwert nicht ohne Begründung überschreiten." }
  ],
  documentRendering: {
    titleFieldId: "dokumententitel",
    partyFieldIds: ["zedent", "zessionar", "drittschuldner"],
    summaryFieldIds: ["nominalwert", "kaufpreis", "offeneOderStilleZession", "ursprungsfaelligkeit"],
    signatureFieldIds: ["zedent", "zessionar"]
  },
  marketplaceMeta: {
    listingTitleField: "dokumententitel",
    summaryFields: ["nominalwert", "kaufpreis", "diskont", "offeneOderStilleZession"],
    internalOnlyFields: ["kaufpreisBegruendung", "streitfallGrundgeschaeft"],
    ndaProtectedFields: ["grundgeschaeft", "dokumentnachweise", "rueckabwicklung"],
    defaultVisibility: "marketplace"
  },
  riskMeta: {
    riskInputs: ["diskont", "gewaerleistungEinbringlichkeit", "rueckgriffsrechte", "prioritaetsregeln"],
    weightings: { diskont: 0.2, gewaerleistungEinbringlichkeit: -0.15, rueckgriffsrechte: -0.1, prioritaetsregeln: 0.25 },
    scoreFormulaHint: "Schwache Gewährleistungen und unklare Prioritätsregeln erhöhen Risiko.",
    requiresManualReviewWhen: ["offeneOderStilleZession = still", "kaufpreis > nominalwert"]
  },
  settlementMeta: {
    dueDateFieldIds: ["ursprungsfaelligkeit"],
    amountFieldIds: ["nominalwert", "kaufpreis", "diskont"],
    triggerFieldIds: ["inkassoDurch", "rueckabwicklung"],
    eventMapping: { collectionDue: "PAYMENT_DUE", collected: "PAYMENT_CONFIRMED", dispute: "DEFAULT_TRIGGERED" }
  },
  disputeMeta: {
    defaultDisputeType: "TRANSFER_DISPUTE",
    evidenceFieldIds: ["dokumentnachweise", "grundgeschaeft", "streitfallGrundgeschaeft"],
    jurisdictionFieldId: "gerichtsstand",
    escalationPath: ["notice_to_parties", "mediation", "court_or_arbitration"]
  }
};
