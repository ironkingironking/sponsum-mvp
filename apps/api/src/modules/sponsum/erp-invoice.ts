/**
 * Live check of an ERPNext Sales Invoice behind a Sponsum receivable (audit DK-31, 2026-10-08).
 *
 * ERPNext stays the system of record for the invoice: a receivable derived from a Sales Invoice takes amount,
 * currency and due date from ERPNext, and every step that sells or finances it (offer, sale, confirmation of a
 * capital need, Lending handover) re-reads the invoice first. Only a submitted invoice (docstatus 1) that is not a
 * credit note and still has an outstanding amount counts as open. The read uses the same technical ERPNext user as
 * the Lending bridge; without it the check fails closed.
 */
import { DomainError } from "@sponsum/shared";
import { LendingError, type LendingDeps } from "./lending-bridge.js";

export type OpenSalesInvoice = {
  name: string;
  customer: string;
  company: string;
  currency: string;
  grand_total: string;
  outstanding_amount: string;
  posting_date: string;
  due_date: string;
};

function amount(value: unknown): string {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : "NaN";
}

export function validSalesInvoiceName(value: unknown): string {
  const name = String(value ?? "").trim();
  if (!name || name.length > 140 || /[\x00-\x1f/\\]/.test(name)) {
    throw new DomainError("validation_error", "Bitte eine gültige ERPNext-Rechnungsnummer angeben.");
  }
  return name;
}

/** Reads the Sales Invoice and returns it only when it is open; otherwise a stable German DomainError. */
export async function readOpenSalesInvoice(nameInput: string, deps: LendingDeps): Promise<OpenSalesInvoice> {
  const name = validSalesInvoiceName(nameInput);
  if (!deps.config || !deps.transport) {
    throw new DomainError(
      "erp_unavailable",
      "Die ERPNext-Rechnung kann nicht geprüft werden: die ERPNext-Anbindung ist nicht eingerichtet."
    );
  }
  let doc: Record<string, unknown> | null;
  try {
    doc = await deps.transport.get("Sales Invoice", name);
  } catch (error) {
    if (error instanceof LendingError) {
      throw new DomainError("erp_unavailable", `Die ERPNext-Rechnung kann nicht geprüft werden. ${error.message}`);
    }
    throw error;
  }
  if (!doc) throw new DomainError("invoice_not_found", `Die Rechnung ${name} gibt es in ERPNext nicht.`);
  const outstanding = Number(doc.outstanding_amount);
  if (Number(doc.docstatus) !== 1) {
    throw new DomainError(
      "invoice_not_open",
      Number(doc.docstatus) === 2
        ? `Die Rechnung ${name} ist in ERPNext storniert.`
        : `Die Rechnung ${name} ist in ERPNext noch nicht gebucht.`
    );
  }
  if (Number(doc.is_return) === 1) {
    throw new DomainError("invoice_not_open", `${name} ist eine Gutschrift und keine offene Forderung.`);
  }
  if (!(Number.isFinite(outstanding) && outstanding > 0)) {
    throw new DomainError("invoice_not_open", `Die Rechnung ${name} ist in ERPNext bezahlt oder ausgeglichen.`);
  }
  return {
    name,
    customer: String(doc.customer ?? ""),
    company: String(doc.company ?? ""),
    currency: String(doc.currency ?? "CHF"),
    grand_total: amount(doc.grand_total),
    outstanding_amount: amount(outstanding),
    posting_date: String(doc.posting_date ?? ""),
    due_date: String(doc.due_date ?? doc.posting_date ?? "")
  };
}
