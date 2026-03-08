import type { InstrumentType } from "./instrument-types";

export type DocumentRequirementType =
  | "assignment_document"
  | "payment_proof"
  | "acceptance_notice"
  | "aval_certificate"
  | "notarial_record"
  | "settlement_confirmation"
  | "reporting_statement"
  | "origin_document"
  | "warranty_schedule"
  | "identity_document"
  | "custom";

export type DocumentComplianceStatus = "missing" | "submitted" | "verified" | "rejected" | "outdated";

export type DocumentRequirementDefinition = {
  id: string;
  instrumentType: InstrumentType;
  label: string;
  description: string;
  documentType: DocumentRequirementType;
  required: boolean;
  fieldIds?: string[];
  clauseIds?: string[];
  settlementEventTypes?: string[];
};

export type UploadedInstrumentDocument = {
  id: string;
  title: string;
  documentType: DocumentRequirementType;
  uploadedAt: string;
  signed: boolean;
  readable: boolean;
  status: DocumentComplianceStatus;
};

export type DocumentRequirementInstance = {
  id: string;
  requirementId: string;
  instrumentId: string;
  status: DocumentComplianceStatus;
  expectedBy?: string;
  linkedDocumentId?: string;
};

export const documentRequirementDefinitions: DocumentRequirementDefinition[] = [
  {
    id: "wechsel-payment-proof",
    instrumentType: "wechsel",
    label: "Zahlungsnachweis bei Verfall",
    description: "Nachweis der Zahlung zum verfalltag",
    documentType: "payment_proof",
    required: true,
    fieldIds: ["verfalltag", "betragNumerisch"],
    settlementEventTypes: ["PAYMENT_DUE", "PAYMENT_CONFIRMED"]
  },
  {
    id: "wechsel-aval-certificate",
    instrumentType: "wechsel",
    label: "Aval Nachweis",
    description: "Beleg fuer Aval, falls avalVorhanden=true",
    documentType: "aval_certificate",
    required: false,
    fieldIds: ["avalVorhanden", "avalist"]
  },
  {
    id: "schuldschein-settlement-confirmation",
    instrumentType: "schuldschein",
    label: "Tilgungs-/Zinsbestaetigung",
    description: "Nachweise fuer Raten- und Zinszahlungen",
    documentType: "settlement_confirmation",
    required: true,
    fieldIds: ["tilgungsmodus", "verzugszins", "endfaelligkeit"],
    settlementEventTypes: ["PARTIAL_PAYMENT", "PAYMENT_CONFIRMED"]
  },
  {
    id: "schuldschein-notarial-record",
    instrumentType: "schuldschein",
    label: "Notarielle Unterlagen",
    description: "Notarielle Dokumente bei Unterwerfung",
    documentType: "notarial_record",
    required: false,
    fieldIds: ["notarielleOption", "vollstreckungsunterwerfung"]
  },
  {
    id: "zession-assignment-document",
    instrumentType: "zession",
    label: "Assignment Document",
    description: "Abtretungsurkunde inkl. Bezug auf Grundgeschaeft",
    documentType: "assignment_document",
    required: true,
    fieldIds: ["abtretungsdatum", "grundgeschaeft", "zedent", "zessionar"]
  },
  {
    id: "zession-origin-document",
    instrumentType: "zession",
    label: "Origin Document",
    description: "Ursprungsdokument der Forderung",
    documentType: "origin_document",
    required: true,
    fieldIds: ["grundgeschaeft", "ursprungsfaelligkeit"]
  },
  {
    id: "zession-warranty-schedule",
    instrumentType: "zession",
    label: "Warranty Schedule",
    description: "Gewaehrleistung fuer Bestand und Einbringlichkeit",
    documentType: "warranty_schedule",
    required: false,
    fieldIds: ["gewaerleistungBestand", "gewaerleistungEinbringlichkeit"]
  },
  {
    id: "commenda-reporting",
    instrumentType: "commenda",
    label: "Reporting Statement",
    description: "Periodische Rechenschafts- und Reportingunterlagen",
    documentType: "reporting_statement",
    required: true,
    fieldIds: ["reportingpflichten", "rechenschaftslegung"],
    clauseIds: ["reportingpflicht"]
  },
  {
    id: "guelt-payment-proof",
    instrumentType: "guelt",
    label: "Rentenzahlungsnachweis",
    description: "Nachweis periodischer Rentenzahlungen",
    documentType: "payment_proof",
    required: true,
    fieldIds: ["zahlungstermine", "rentenhoehe"]
  }
];

export function getDocumentRequirementsByInstrumentType(type: InstrumentType): DocumentRequirementDefinition[] {
  return documentRequirementDefinitions.filter((requirement) => requirement.instrumentType === type);
}
