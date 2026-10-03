import type { VerificationChecks } from "./receivable-types.js";

export type VerificationEvidence = {
  hasContract?: boolean;
  hasPurchaseOrder?: boolean;
  hasInvoice?: boolean;
  invoiceElectronic?: boolean;
  hasPerformance?: boolean;
  hasDelivery?: boolean;
  hasAcceptance?: boolean;
  debtorAcknowledged?: boolean;
  hasDispute?: boolean;
  hasPreviousAssignment?: boolean;
  unpaid?: boolean;
  debtorKyc?: boolean;
  creditorKyc?: boolean;
  hasCreditInfo?: boolean;
  hasHistoricalPayments?: boolean;
  hasPaymentBehavior?: boolean;
  hasKnownSetoffs?: boolean;
  hasCreditNotes?: boolean;
  documentIntegrity?: boolean;
};

const WEIGHTS: Record<keyof VerificationChecks, number> = {
  contract: 8,
  purchase_order: 4,
  invoice: 12,
  invoice_electronic: 6,
  performance_documented: 6,
  delivery_evidence: 8,
  acceptance: 8,
  debtor_acknowledged: 8,
  no_dispute: 10,
  no_previous_assignment: 8,
  unpaid: 8,
  debtor_kyc: 4,
  creditor_kyc: 4,
  credit_info: 2,
  historical_payments: 1,
  payment_behavior: 1,
  known_setoffs: 1,
  credit_notes: 0,
  document_integrity: 1
};

export function buildVerificationChecks(evidence: VerificationEvidence): VerificationChecks {
  return {
    contract: Boolean(evidence.hasContract),
    purchase_order: Boolean(evidence.hasPurchaseOrder),
    invoice: Boolean(evidence.hasInvoice ?? true),
    invoice_electronic: Boolean(evidence.invoiceElectronic ?? true),
    performance_documented: Boolean(evidence.hasPerformance),
    delivery_evidence: Boolean(evidence.hasDelivery),
    acceptance: Boolean(evidence.hasAcceptance),
    debtor_acknowledged: Boolean(evidence.debtorAcknowledged),
    no_dispute: evidence.hasDispute === undefined ? true : !evidence.hasDispute,
    no_previous_assignment: evidence.hasPreviousAssignment === undefined ? true : !evidence.hasPreviousAssignment,
    unpaid: evidence.unpaid === undefined ? true : Boolean(evidence.unpaid),
    debtor_kyc: Boolean(evidence.debtorKyc),
    creditor_kyc: Boolean(evidence.creditorKyc),
    credit_info: Boolean(evidence.hasCreditInfo),
    historical_payments: Boolean(evidence.hasHistoricalPayments),
    payment_behavior: Boolean(evidence.hasPaymentBehavior),
    known_setoffs: evidence.hasKnownSetoffs === undefined ? true : !evidence.hasKnownSetoffs,
    credit_notes: Boolean(evidence.hasCreditNotes),
    document_integrity: evidence.documentIntegrity === undefined ? true : Boolean(evidence.documentIntegrity)
  };
}

export function scoreVerification(checks: VerificationChecks): number {
  let earned = 0;
  let total = 0;
  for (const [key, weight] of Object.entries(WEIGHTS) as Array<[keyof VerificationChecks, number]>) {
    if (weight <= 0) continue;
    total += weight;
    if (checks[key]) earned += weight;
  }
  return Math.round((earned / total) * 100);
}
