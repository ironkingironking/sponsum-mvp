import {
  getDocumentRequirementsByInstrumentType,
  getInstrumentTemplate,
  seededInstrumentExamples,
  type DocumentRequirementInstance,
  type InstrumentType,
  type UploadedInstrumentDocument
} from "@/lib/instruments";
import type { StructuredDisputeCase } from "@/lib/disputes/dispute-types";
import type { SettlementEvent } from "@/lib/settlement/settlement-types";
import type { InstrumentContext, StructuredClaim } from "./claim-types";

function fromSeed(type: InstrumentType) {
  return seededInstrumentExamples.find((example) => example.templateType === type);
}

function makeDocumentRequirementInstances(
  instrumentId: string,
  type: InstrumentType,
  statuses: Array<{ requirementId: string; status: DocumentRequirementInstance["status"]; linkedDocumentId?: string; expectedBy?: string }>
): DocumentRequirementInstance[] {
  return statuses.map((entry, index) => ({
    id: `${instrumentId}-req-${index + 1}`,
    instrumentId,
    requirementId: entry.requirementId,
    status: entry.status,
    linkedDocumentId: entry.linkedDocumentId,
    expectedBy: entry.expectedBy
  }));
}

function makeContext(args: {
  id: string;
  type: InstrumentType;
  title: string;
  observedValues?: Record<string, unknown>;
  parties: Array<{ id: string; role: string; displayName: string }>;
  settlementEvents: SettlementEvent[];
  requirementStatuses: Array<{ requirementId: string; status: DocumentRequirementInstance["status"]; linkedDocumentId?: string; expectedBy?: string }>;
  uploadedDocuments: UploadedInstrumentDocument[];
  obligations?: InstrumentContext["obligations"];
}): InstrumentContext {
  const seed = fromSeed(args.type);
  const template = getInstrumentTemplate(args.type);
  const values = {
    ...(seed?.values || {}),
    dokumententitel: args.title
  };
  const selectedClauseIds = new Set(seed?.selectedClauseIds || template.clauseBlocks.filter((clause) => clause.defaultSelected).map((clause) => clause.id));
  const clauseOverrides = seed?.clauseOverrides || {};

  return {
    id: args.id,
    title: args.title,
    template,
    values,
    observedValues: args.observedValues,
    parties: args.parties,
    clauses: template.clauseBlocks.map((clause) => ({
      ...clause,
      selected: selectedClauseIds.has(clause.id),
      effectiveText: clauseOverrides[clause.id] || clause.text
    })),
    settlementEvents: args.settlementEvents,
    documentRequirementDefinitions: getDocumentRequirementsByInstrumentType(args.type),
    documentRequirementInstances: makeDocumentRequirementInstances(args.id, args.type, args.requirementStatuses),
    uploadedDocuments: args.uploadedDocuments,
    obligations: args.obligations || []
  };
}

const wechselContext = makeContext({
  id: "inst-wechsel-01",
  type: "wechsel",
  title: "Wechsel Nordhandel 2026-11",
  observedValues: {
    verfalltag: "2026-04-30",
    avalVorhanden: true,
    avalist: ""
  },
  parties: [
    { id: "p-1", role: "aussteller", displayName: "Helvetic Trading AG" },
    { id: "p-2", role: "bezogener", displayName: "Alpine Steel GmbH" },
    { id: "p-3", role: "remittent", displayName: "Rhine Factoring SA" }
  ],
  settlementEvents: [
    {
      id: "payment_due_2026_04_30",
      instrumentId: "inst-wechsel-01",
      eventType: "payment_due",
      obligationKey: "payment_at_verfalltag",
      dueAt: "2026-04-30T00:00:00.000Z",
      expectedAmount: 125000,
      settledAmount: 0,
      currency: "CHF",
      settlementStatus: "overdue",
      settlementChannel: "bank_transfer",
      proofDocuments: [],
      varianceReason: "payment not received",
      breachFlags: ["not_settled", "missing_proof", "late_payment"]
    }
  ],
  requirementStatuses: [
    { requirementId: "wechsel-payment-proof", status: "missing", expectedBy: "2026-05-01T00:00:00.000Z" },
    { requirementId: "wechsel-aval-certificate", status: "missing", expectedBy: "2026-03-15T00:00:00.000Z" }
  ],
  uploadedDocuments: [
    {
      id: "doc-w-1",
      title: "Wechselurkunde unterschrieben",
      documentType: "origin_document",
      uploadedAt: "2026-03-02T09:00:00.000Z",
      signed: true,
      readable: true,
      status: "verified"
    }
  ],
  obligations: [
    {
      key: "payment_at_verfalltag",
      label: "Zahlung zum verfalltag",
      expected: "2026-04-30 / 125000 CHF",
      actual: "nicht bezahlt",
      partyRole: "bezogener"
    }
  ]
});

const zessionContext = makeContext({
  id: "inst-zession-01",
  type: "zession",
  title: "Zession Forderungspool Q3",
  observedValues: {
    gewaerleistungBestand: false,
    benachrichtigungDrittschuldner: "keine bestaetigte Zustellung"
  },
  parties: [
    { id: "p-4", role: "zedent", displayName: "NordInvoice AG" },
    { id: "p-5", role: "zessionar", displayName: "Sponsum Receivable Fund" },
    { id: "p-6", role: "drittschuldner", displayName: "Retail Group Central" }
  ],
  settlementEvents: [
    {
      id: "zession_due_2026_09_30",
      instrumentId: "inst-zession-01",
      eventType: "payment_due",
      obligationKey: "third_party_collection",
      dueAt: "2026-09-30T00:00:00.000Z",
      expectedAmount: 350000,
      settledAmount: 0,
      currency: "CHF",
      settlementStatus: "due",
      settlementChannel: "bank_transfer",
      proofDocuments: ["doc-z-2"],
      breachFlags: ["condition_unmet"]
    }
  ],
  requirementStatuses: [
    { requirementId: "zession-assignment-document", status: "submitted", linkedDocumentId: "doc-z-1" },
    { requirementId: "zession-origin-document", status: "missing" },
    { requirementId: "zession-warranty-schedule", status: "rejected", linkedDocumentId: "doc-z-2" }
  ],
  uploadedDocuments: [
    {
      id: "doc-z-1",
      title: "Assignment Document v1",
      documentType: "assignment_document",
      uploadedAt: "2026-07-02T14:00:00.000Z",
      signed: false,
      readable: true,
      status: "rejected"
    },
    {
      id: "doc-z-2",
      title: "Warranty Memo",
      documentType: "warranty_schedule",
      uploadedAt: "2026-07-02T15:00:00.000Z",
      signed: true,
      readable: false,
      status: "rejected"
    }
  ],
  obligations: [
    {
      key: "receivable_validity_warranty",
      label: "Gewaehrleistung Bestand der Forderung",
      expected: true,
      actual: false,
      partyRole: "zedent"
    }
  ]
});

const schuldscheinContext = makeContext({
  id: "inst-schuldschein-01",
  type: "schuldschein",
  title: "Schuldschein Maschinenfinanzierung",
  observedValues: {
    verzugszins: 12.5
  },
  parties: [
    { id: "p-7", role: "schuldner", displayName: "Keller Maschinenbau GmbH" },
    { id: "p-8", role: "glaeubiger", displayName: "Sponsum Debt Partners" }
  ],
  settlementEvents: [
    {
      id: "ssd-rate-2026-05-31",
      instrumentId: "inst-schuldschein-01",
      eventType: "partial_payment",
      obligationKey: "installment_2026_05",
      dueAt: "2026-05-31T00:00:00.000Z",
      expectedAmount: 40000,
      settledAmount: 18000,
      currency: "EUR",
      settlementStatus: "partial",
      settlementChannel: "bank_transfer",
      proofDocuments: ["doc-s-1"],
      varianceReason: "partial transfer received",
      breachFlags: ["partial_payment"]
    }
  ],
  requirementStatuses: [{ requirementId: "schuldschein-settlement-confirmation", status: "submitted", linkedDocumentId: "doc-s-1" }],
  uploadedDocuments: [
    {
      id: "doc-s-1",
      title: "Bank transfer receipt rate 05/2026",
      documentType: "settlement_confirmation",
      uploadedAt: "2026-06-02T09:40:00.000Z",
      signed: false,
      readable: true,
      status: "submitted"
    }
  ],
  obligations: [
    {
      key: "installment_2026_05",
      label: "Rate Mai 2026",
      expected: "40000 EUR",
      actual: "18000 EUR",
      partyRole: "schuldner"
    }
  ]
});

const commendaContext = makeContext({
  id: "inst-commenda-01",
  type: "commenda",
  title: "Commenda Spice Route 2026",
  observedValues: {
    reportingpflichten: "quartalsweise statt monatlich geliefert"
  },
  parties: [
    { id: "p-9", role: "kapitalgeber", displayName: "Ines Investor" },
    { id: "p-10", role: "operativerPartner", displayName: "Olaf Operator" }
  ],
  settlementEvents: [
    {
      id: "com-reporting-2026-06",
      instrumentId: "inst-commenda-01",
      eventType: "condition_unmet",
      obligationKey: "monthly_reporting",
      dueAt: "2026-06-05T00:00:00.000Z",
      expectedAmount: 0,
      settledAmount: 0,
      currency: "USD",
      settlementStatus: "failed",
      settlementChannel: "escrow",
      proofDocuments: [],
      varianceReason: "report missing",
      breachFlags: ["condition_unmet", "missing_proof"]
    }
  ],
  requirementStatuses: [{ requirementId: "commenda-reporting", status: "missing", expectedBy: "2026-06-05T00:00:00.000Z" }],
  uploadedDocuments: [],
  obligations: [
    {
      key: "monthly_reporting",
      label: "Monatliches Reporting",
      expected: "vollstaendiger Monatsreport",
      actual: "fehlend",
      partyRole: "operativerPartner"
    }
  ]
});

const gueltContext = makeContext({
  id: "inst-guelt-01",
  type: "guelt",
  title: "Gueltvertrag Bern-Land Nr. 88",
  observedValues: {
    zahlungstermine: "Quartalsende ungehalten fuer Q2 2026"
  },
  parties: [
    { id: "p-11", role: "rentenglaeubiger", displayName: "Bern Capital Cooperative" },
    { id: "p-12", role: "verpflichteter", displayName: "Estate Holder Bern Sued" }
  ],
  settlementEvents: [
    {
      id: "guelt-rente-2026-q2",
      instrumentId: "inst-guelt-01",
      eventType: "payment_due",
      obligationKey: "annuity_q2_2026",
      dueAt: "2026-06-30T00:00:00.000Z",
      expectedAmount: 9000,
      settledAmount: 0,
      currency: "CHF",
      settlementStatus: "overdue",
      settlementChannel: "bank_transfer",
      proofDocuments: [],
      breachFlags: ["not_settled", "late_payment", "missing_proof"]
    }
  ],
  requirementStatuses: [{ requirementId: "guelt-payment-proof", status: "missing", expectedBy: "2026-07-01T00:00:00.000Z" }],
  uploadedDocuments: [],
  obligations: [
    {
      key: "annuity_q2_2026",
      label: "Rentenrate Q2 2026",
      expected: "9000 CHF",
      actual: "0 CHF",
      partyRole: "verpflichteter"
    }
  ]
});

export const claimMockInstrumentContexts: InstrumentContext[] = [
  wechselContext,
  zessionContext,
  schuldscheinContext,
  commendaContext,
  gueltContext
];

export const claimMocks: StructuredClaim[] = [
  {
    id: "clm-wechsel-01",
    disputeId: "disp-wechsel-01",
    instrumentId: wechselContext.id,
    claimType: "non_payment",
    category: "payment_default",
    title: "Nichtzahlung zum Verfalltag",
    summary: "Zahlung am verfalltag wurde nicht geleistet.",
    statementByClaimant: "Die Summe war am 30.04.2026 faellig und ist nicht eingegangen.",
    amountInDispute: 125000,
    currency: "CHF",
    requestedRemedy: ["payment_order", "late_fee", "escalation"],
    status: "open",
    severity: "critical",
    evidenceTypes: ["payment_proof", "settlement_log", "notice_letter"],
    createdAt: "2026-05-02T10:10:00.000Z",
    updatedAt: "2026-05-02T10:10:00.000Z",
    targetType: "settlement_event",
    targetTemplateFieldId: "verfalltag",
    targetClauseBlockId: "protestverzicht",
    targetSettlementEventId: "payment_due_2026_04_30",
    targetDocumentRequirementId: "inst-wechsel-01-req-1",
    targetGroupKey: "fristen",
    targetPartyRole: "bezogener",
    targetObligationKey: "payment_at_verfalltag",
    targetValueSnapshot: {
      fieldLabel: "Verfalltag",
      expectedDueAt: "2026-04-30",
      clause: "protestverzicht",
      settlementStatus: "overdue",
      documentRequirementStatus: "missing"
    },
    expectedValue: { amount: 125000, dueAt: "2026-04-30" },
    actualValue: { amount: 0, proofDocuments: 0 },
    breachDetectedFrom: "settlement_monitor",
    sourceContext: {
      templateType: "wechsel",
      templateVersion: wechselContext.template.version,
      templateTitle: wechselContext.template.title,
      instrumentTitle: wechselContext.title,
      createdAt: "2026-05-02T10:10:00.000Z",
      actor: "Iris Issuer"
    }
  },
  {
    id: "clm-wechsel-02",
    disputeId: "disp-wechsel-01",
    instrumentId: wechselContext.id,
    claimType: "missing_security",
    category: "security_breach",
    title: "Aval fehlt trotz Pflicht",
    summary: "Aval wurde als vorhanden markiert, aber kein aval_certificate eingereicht.",
    statementByClaimant: "Der Avalist wurde nicht nachgewiesen.",
    requestedRemedy: ["specific_performance", "recourse"],
    status: "open",
    severity: "warning",
    evidenceTypes: ["assignment_document", "signature_page"],
    createdAt: "2026-05-03T09:00:00.000Z",
    updatedAt: "2026-05-03T09:00:00.000Z",
    targetType: "template_field",
    targetTemplateFieldId: "avalVorhanden",
    targetDocumentRequirementId: "inst-wechsel-01-req-2",
    targetGroupKey: "sicherheiten",
    targetPartyRole: "aussteller",
    targetObligationKey: "aval_provision",
    targetValueSnapshot: {
      fieldLabel: "Aval vorhanden",
      valueAtClaimCreation: true,
      requirement: "Aval Nachweis",
      requirementStatus: "missing"
    },
    expectedValue: true,
    actualValue: false,
    breachDetectedFrom: "document_compliance_monitor",
    sourceContext: {
      templateType: "wechsel",
      templateVersion: wechselContext.template.version,
      templateTitle: wechselContext.template.title,
      instrumentTitle: wechselContext.title,
      createdAt: "2026-05-03T09:00:00.000Z",
      actor: "Iris Issuer"
    }
  },
  {
    id: "clm-zession-01",
    disputeId: "disp-zession-01",
    instrumentId: zessionContext.id,
    claimType: "warranty_breach",
    category: "warranty_dispute",
    title: "Bestand der Forderung bestritten",
    summary: "gewaerleistungBestand wird als verletzt geruegt.",
    statementByClaimant: "Die abgetretene Forderung bestand nicht in zugesicherter Form.",
    amountInDispute: 332000,
    currency: "CHF",
    requestedRemedy: ["recourse", "rescission", "indemnity"],
    status: "under_review",
    severity: "critical",
    evidenceTypes: ["assignment_document", "origin_document", "warranty_schedule"],
    evidenceDocumentIds: ["doc-z-1", "doc-z-2"],
    createdAt: "2026-07-06T11:30:00.000Z",
    updatedAt: "2026-07-06T11:30:00.000Z",
    targetType: "template_field",
    targetTemplateFieldId: "gewaerleistungBestand",
    targetDocumentRequirementId: "inst-zession-01-req-2",
    targetClauseBlockId: "rueckgriff",
    targetGroupKey: "sicherheiten",
    targetPartyRole: "zedent",
    targetObligationKey: "receivable_validity_warranty",
    targetValueSnapshot: {
      fieldLabel: "Gewaehrleistung Bestand",
      expected: true,
      actual: false,
      linkedClause: "rueckgriff",
      documentStatus: "missing"
    },
    expectedValue: true,
    actualValue: false,
    breachDetectedFrom: "manual_user_input",
    sourceContext: {
      templateType: "zession",
      templateVersion: zessionContext.template.version,
      templateTitle: zessionContext.template.title,
      instrumentTitle: zessionContext.title,
      createdAt: "2026-07-06T11:30:00.000Z",
      actor: "Sponsum Receivable Fund"
    }
  },
  {
    id: "clm-zession-02",
    disputeId: "disp-zession-01",
    instrumentId: zessionContext.id,
    claimType: "inconsistent_document",
    category: "document_non_compliance",
    title: "Assignment document inkonsistent",
    summary: "Uploaded assignment_document ist abgelehnt/unsigniert.",
    statementByClaimant: "Das Dokument ist inhaltlich und formal unzureichend.",
    requestedRemedy: ["document_cure", "specific_performance"],
    status: "open",
    severity: "warning",
    evidenceTypes: ["assignment_document", "signature_page"],
    evidenceDocumentIds: ["doc-z-1"],
    createdAt: "2026-07-06T14:00:00.000Z",
    updatedAt: "2026-07-06T14:00:00.000Z",
    targetType: "uploaded_document",
    targetDocumentId: "doc-z-1",
    targetDocumentRequirementId: "inst-zession-01-req-1",
    targetGroupKey: "dokumente",
    targetValueSnapshot: {
      documentId: "doc-z-1",
      status: "rejected",
      signed: false
    },
    expectedValue: "verified/signed",
    actualValue: "rejected/unsigned",
    breachDetectedFrom: "document_compliance_monitor",
    sourceContext: {
      templateType: "zession",
      templateVersion: zessionContext.template.version,
      templateTitle: zessionContext.template.title,
      instrumentTitle: zessionContext.title,
      createdAt: "2026-07-06T14:00:00.000Z",
      actor: "Sponsum Receivable Fund"
    }
  },
  {
    id: "clm-schuldschein-01",
    disputeId: "disp-schuldschein-01",
    instrumentId: schuldscheinContext.id,
    claimType: "partial_payment",
    category: "settlement_variance",
    title: "Teilzahlung statt voller Rate",
    summary: "Installment 2026-05 nur teilweise bezahlt.",
    statementByClaimant: "Es wurden nur 18.000 EUR statt 40.000 EUR gezahlt.",
    amountInDispute: 22000,
    currency: "EUR",
    requestedRemedy: ["payment_order", "late_fee"],
    status: "open",
    severity: "warning",
    evidenceTypes: ["payment_proof", "settlement_log"],
    evidenceDocumentIds: ["doc-s-1"],
    createdAt: "2026-06-03T08:00:00.000Z",
    updatedAt: "2026-06-03T08:00:00.000Z",
    targetType: "settlement_event",
    targetSettlementEventId: "ssd-rate-2026-05-31",
    targetTemplateFieldId: "endfaelligkeit",
    targetGroupKey: "settlement",
    targetPartyRole: "schuldner",
    targetObligationKey: "installment_2026_05",
    targetValueSnapshot: {
      settlementEventId: "ssd-rate-2026-05-31",
      expectedAmount: 40000,
      settledAmount: 18000
    },
    expectedValue: 40000,
    actualValue: 18000,
    breachDetectedFrom: "settlement_monitor",
    sourceContext: {
      templateType: "schuldschein",
      templateVersion: schuldscheinContext.template.version,
      templateTitle: schuldscheinContext.template.title,
      instrumentTitle: schuldscheinContext.title,
      createdAt: "2026-06-03T08:00:00.000Z",
      actor: "Sponsum Debt Partners"
    }
  },
  {
    id: "clm-schuldschein-02",
    disputeId: "disp-schuldschein-01",
    instrumentId: schuldscheinContext.id,
    claimType: "clause_breach",
    category: "clause_dispute",
    title: "Verzugszins streitig",
    summary: "Angewendeter Verzugszins weicht vom Template-Wert ab.",
    statementByClaimant: "Der Schuldner bestreitet den angesetzten Verzugszins.",
    amountInDispute: 3500,
    currency: "EUR",
    requestedRemedy: ["declaratory_relief", "late_fee"],
    status: "under_review",
    severity: "warning",
    evidenceTypes: ["contract_extract", "settlement_log"],
    createdAt: "2026-06-03T09:00:00.000Z",
    updatedAt: "2026-06-03T09:00:00.000Z",
    targetType: "template_field",
    targetTemplateFieldId: "verzugszins",
    targetClauseBlockId: "mahnverfahren",
    targetGroupKey: "settlement",
    targetValueSnapshot: {
      fieldLabel: "Verzugszins",
      expected: 10.5,
      actual: 12.5
    },
    expectedValue: 10.5,
    actualValue: 12.5,
    breachDetectedFrom: "manual_user_input",
    sourceContext: {
      templateType: "schuldschein",
      templateVersion: schuldscheinContext.template.version,
      templateTitle: schuldscheinContext.template.title,
      instrumentTitle: schuldscheinContext.title,
      createdAt: "2026-06-03T09:00:00.000Z",
      actor: "Keller Maschinenbau GmbH"
    }
  },
  {
    id: "clm-commenda-01",
    disputeId: "disp-commenda-01",
    instrumentId: commendaContext.id,
    claimType: "reporting_breach",
    category: "reporting_breach",
    title: "Reportingpflicht verletzt",
    summary: "Monatsreport fehlt trotz ClauseBlock reportingpflicht.",
    statementByClaimant: "Es wurde kein prueffaehiger Monatsreport geliefert.",
    requestedRemedy: ["information_order", "penalty", "escalation"],
    status: "open",
    severity: "critical",
    evidenceTypes: ["reporting_statement", "notice_letter", "contract_extract"],
    createdAt: "2026-06-06T10:00:00.000Z",
    updatedAt: "2026-06-06T10:00:00.000Z",
    targetType: "clause_block",
    targetTemplateFieldId: "reportingpflichten",
    targetClauseBlockId: "reportingpflicht",
    targetSettlementEventId: "com-reporting-2026-06",
    targetDocumentRequirementId: "inst-commenda-01-req-1",
    targetGroupKey: "settlement",
    targetPartyRole: "operativerPartner",
    targetObligationKey: "monthly_reporting",
    targetValueSnapshot: {
      clause: "reportingpflicht",
      fieldLabel: "Reportingpflichten",
      requirementStatus: "missing",
      settlementStatus: "failed"
    },
    expectedValue: "monatlich / vollstaendig",
    actualValue: "fehlend",
    breachDetectedFrom: "rule_engine",
    sourceContext: {
      templateType: "commenda",
      templateVersion: commendaContext.template.version,
      templateTitle: commendaContext.template.title,
      instrumentTitle: commendaContext.title,
      createdAt: "2026-06-06T10:00:00.000Z",
      actor: "Ines Investor"
    }
  },
  {
    id: "clm-guelt-01",
    disputeId: "disp-guelt-01",
    instrumentId: gueltContext.id,
    claimType: "non_payment",
    category: "payment_default",
    title: "Rentenzahlung Q2 ausgeblieben",
    summary: "Periodische Rentenzahlung nicht geleistet.",
    statementByClaimant: "Die Rate Q2 2026 in Hoehe von 9.000 CHF fehlt.",
    amountInDispute: 9000,
    currency: "CHF",
    requestedRemedy: ["payment_order", "late_fee", "escalation"],
    status: "open",
    severity: "critical",
    evidenceTypes: ["payment_proof", "settlement_log"],
    createdAt: "2026-07-01T08:00:00.000Z",
    updatedAt: "2026-07-01T08:00:00.000Z",
    targetType: "settlement_event",
    targetTemplateFieldId: "zahlungstermine",
    targetSettlementEventId: "guelt-rente-2026-q2",
    targetDocumentRequirementId: "inst-guelt-01-req-1",
    targetGroupKey: "fristen",
    targetPartyRole: "verpflichteter",
    targetObligationKey: "annuity_q2_2026",
    targetValueSnapshot: {
      fieldLabel: "Zahlungstermine",
      settlementStatus: "overdue",
      expectedAmount: 9000,
      settledAmount: 0
    },
    expectedValue: 9000,
    actualValue: 0,
    breachDetectedFrom: "settlement_monitor",
    sourceContext: {
      templateType: "guelt",
      templateVersion: gueltContext.template.version,
      templateTitle: gueltContext.template.title,
      instrumentTitle: gueltContext.title,
      createdAt: "2026-07-01T08:00:00.000Z",
      actor: "Bern Capital Cooperative"
    }
  }
];

export const disputeMocks: StructuredDisputeCase[] = [
  {
    id: "disp-wechsel-01",
    instrumentId: wechselContext.id,
    instrumentTitle: wechselContext.title,
    title: "Wechsel Nichtzahlung + Aval Streit",
    summary: "Nichtzahlung zum Verfall und fehlender Aval-Nachweis.",
    status: "open",
    escalationLevel: "level_1",
    claimant: "Rhine Factoring SA",
    respondent: "Alpine Steel GmbH",
    owner: "Dispute Desk A",
    openedAt: "2026-05-03T10:00:00.000Z",
    responseDueAt: "2026-05-10T00:00:00.000Z",
    claims: claimMocks.filter((claim) => claim.disputeId === "disp-wechsel-01")
  },
  {
    id: "disp-zession-01",
    instrumentId: zessionContext.id,
    instrumentTitle: zessionContext.title,
    title: "Zession Bestand + Dokumentklarheit",
    summary: "Bestand der Forderung und assignment_document werden bestritten.",
    status: "under_review",
    escalationLevel: "level_2",
    claimant: "Sponsum Receivable Fund",
    respondent: "NordInvoice AG",
    owner: "Legal Ops",
    openedAt: "2026-07-06T12:00:00.000Z",
    responseDueAt: "2026-07-14T00:00:00.000Z",
    claims: claimMocks.filter((claim) => claim.disputeId === "disp-zession-01")
  },
  {
    id: "disp-schuldschein-01",
    instrumentId: schuldscheinContext.id,
    instrumentTitle: schuldscheinContext.title,
    title: "Schuldschein Teilzahlung + Verzugszins",
    summary: "Teilzahlung und Verzugszinsberechnung streitig.",
    status: "mediation",
    escalationLevel: "level_2",
    claimant: "Sponsum Debt Partners",
    respondent: "Keller Maschinenbau GmbH",
    owner: "Mediation Team",
    openedAt: "2026-06-03T09:15:00.000Z",
    responseDueAt: "2026-06-15T00:00:00.000Z",
    claims: claimMocks.filter((claim) => claim.disputeId === "disp-schuldschein-01")
  },
  {
    id: "disp-commenda-01",
    instrumentId: commendaContext.id,
    instrumentTitle: commendaContext.title,
    title: "Commenda Reportingpflicht",
    summary: "Reportingpflicht laut ClauseBlock reportingpflicht verletzt.",
    status: "open",
    escalationLevel: "level_1",
    claimant: "Ines Investor",
    respondent: "Olaf Operator",
    owner: "Dispute Desk B",
    openedAt: "2026-06-06T10:05:00.000Z",
    responseDueAt: "2026-06-12T00:00:00.000Z",
    claims: claimMocks.filter((claim) => claim.disputeId === "disp-commenda-01")
  },
  {
    id: "disp-guelt-01",
    instrumentId: gueltContext.id,
    instrumentTitle: gueltContext.title,
    title: "Guelt Rentenausfall Q2",
    summary: "Periodische Rentenzahlung ausstehend.",
    status: "arbitration",
    escalationLevel: "level_3",
    claimant: "Bern Capital Cooperative",
    respondent: "Estate Holder Bern Sued",
    owner: "Arbitration Counsel",
    openedAt: "2026-07-01T08:10:00.000Z",
    responseDueAt: "2026-07-20T00:00:00.000Z",
    claims: claimMocks.filter((claim) => claim.disputeId === "disp-guelt-01")
  }
];

export function getInstrumentContextById(id: string) {
  return claimMockInstrumentContexts.find((context) => context.id === id);
}

export function getDisputeMockById(id: string) {
  return disputeMocks.find((dispute) => dispute.id === id);
}

export function getClaimsByInstrumentId(instrumentId: string) {
  return claimMocks.filter((claim) => claim.instrumentId === instrumentId);
}
