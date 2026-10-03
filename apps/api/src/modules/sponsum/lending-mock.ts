/**
 * In-memory stand-in for the slice of Frappe Lending's REST API that lending-bridge.ts uses (wave 3, mock-first).
 * For tests and local development without erp.movena.ch. It mimics Frappe's behaviour where it matters:
 * docstatus, the Loan Application -> Loan mapping that carries same-named fields (get_mapped_doc), and a repayment
 * schedule owned by Lending. It never computes anything Sponsum would show as its own.
 */
import type { LendingDoc, LendingFilter, LendingTransport } from "./lending-bridge.js";

export type LendingMock = LendingTransport & {
  docs: Map<string, LendingDoc[]>;
  calls: Array<{ op: "list" | "get" | "insert"; doctype: string }>;
  addCustomer(name: string): void;
  /** Lending-side steps a lender does in the desk, here for tests: approve, create loan, disburse with schedule. */
  approveAndCreateLoan(applicationName: string, schedule?: Array<{ payment_date: string; total_payment: number }>): string;
};

function matches(doc: LendingDoc, filters: LendingFilter[]): boolean {
  return filters.every(([field, op, value]) => {
    const actual = doc[field] ?? (field === "docstatus" ? 0 : null);
    return op === "=" ? actual === value : actual !== value;
  });
}

export function createLendingMock(): LendingMock {
  const docs = new Map<string, LendingDoc[]>();
  const calls: LendingMock["calls"] = [];
  const counters = new Map<string, number>();
  const table = (doctype: string) => {
    if (!docs.has(doctype)) docs.set(doctype, []);
    return docs.get(doctype)!;
  };
  const nextName = (prefix: string) => {
    const next = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, next);
    return `${prefix}-${String(next).padStart(5, "0")}`;
  };
  const pick = (doc: LendingDoc, fields: string[]) => Object.fromEntries(fields.map((field) => [field, doc[field]]));

  return {
    docs,
    calls,
    async list(doctype, filters, fields, limit = 20) {
      calls.push({ op: "list", doctype });
      return table(doctype)
        .filter((doc) => matches(doc, filters))
        .slice(0, limit)
        .map((doc) => pick(doc, fields));
    },
    async get(doctype, name) {
      calls.push({ op: "get", doctype });
      const doc = table(doctype).find((candidate) => candidate.name === name);
      return doc ? structuredClone(doc) : null;
    },
    async insert(doctype, doc) {
      calls.push({ op: "insert", doctype });
      const prefix = doctype === "Loan Application" ? "ACC-LOAP-2026" : doctype === "Loan" ? "ACC-LOAN-2026" : doctype;
      const stored: LendingDoc = { ...doc, name: nextName(prefix), docstatus: 0, status: doctype === "Loan Application" ? "Open" : "Draft" };
      table(doctype).push(stored);
      return structuredClone(stored);
    },
    addCustomer(name) {
      table("Customer").push({ name, customer_name: name, docstatus: 0, disabled: 0 });
    },
    approveAndCreateLoan(applicationName, schedule = []) {
      const application = table("Loan Application").find((doc) => doc.name === applicationName);
      if (!application) throw new Error(`no Loan Application ${applicationName}`);
      Object.assign(application, { status: "Approved", docstatus: 1 });
      // get_mapped_doc: fields with the same name are carried over (the movena_sponsum_* fields are not no_copy).
      const { name: _name, status: _status, docstatus: _docstatus, ...carried } = application;
      const loan: LendingDoc = {
        ...carried,
        name: nextName("ACC-LOAN-2026"),
        loan_application: applicationName,
        status: "Disbursed",
        docstatus: 1,
        disbursed_amount: application.loan_amount,
        total_amount_paid: 0,
        total_payment: schedule.reduce((sum, row) => sum + row.total_payment, 0)
      };
      table("Loan").push(loan);
      table("Loan Repayment Schedule").push({
        name: nextName("LN-RPS-2026"),
        loan: loan.name,
        status: "Active",
        docstatus: 1,
        repayment_schedule: schedule.map((row) => ({ ...row }))
      });
      return String(loan.name);
    }
  };
}
