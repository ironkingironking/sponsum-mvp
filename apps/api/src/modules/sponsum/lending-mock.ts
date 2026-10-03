/**
 * In-memory stand-in for the slice of Frappe Lending's REST API that lending-bridge.ts uses (wave 3, mock-first).
 * For tests and local development without erp.movena.ch. It mimics Frappe's behaviour where it matters:
 * docstatus, the Loan Application -> Loan mapping that carries same-named fields (get_mapped_doc), and a repayment
 * schedule owned by Lending. It never computes anything Sponsum would show as its own.
 */
import { LendingError, type LendingDoc, type LendingFilter, type LendingTransport } from "./lending-bridge.js";

export type LendingMock = LendingTransport & {
  docs: Map<string, LendingDoc[]>;
  calls: Array<{ op: "list" | "get" | "insert"; doctype: string }>;
  addCustomer(name: string): void;
  /** O12: a security with its type (haircut/LTV) and optionally a price valid in [from, upto]. */
  addSecurity(code: string, type: string, ltv: number, price?: number, valid?: { from: string; upto: string }): void;
  addShortfall(loan: string, shortfallAmount: number, securityValue: number): void;
  /** Lending-side steps a lender does in the desk, here for tests: approve, create loan, disburse with schedule. */
  approveAndCreateLoan(applicationName: string, schedule?: Array<{ payment_date: string; total_payment: number }>): string;
};

function matches(doc: LendingDoc, filters: LendingFilter[]): boolean {
  return filters.every(([field, op, value]) => {
    const actual = doc[field] ?? (field === "docstatus" ? 0 : null);
    if (op === "<=") return actual !== null && String(actual) <= String(value);
    if (op === ">=") return actual !== null && String(actual) >= String(value);
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
      if (doctype === "Loan Application" && typeof doc.loan_amount !== "number") {
        // Like Lending: validate() compares loan_amount with numbers before Frappe casts types -> TypeError, HTTP 500.
        throw new LendingError("lending_unreachable", "Frappe Lending antwortet mit Fehler 500.");
      }
      const prefix = doctype === "Loan Application" ? "ACC-LOAP-2026" : doctype === "Loan" ? "ACC-LOAN-2026" : doctype;
      const stored: LendingDoc = { ...doc, name: nextName(prefix), docstatus: 0, status: doctype === "Loan Application" ? "Open" : "Draft" };
      if (doctype === "Loan Application" && Array.isArray(doc.proposed_pledges)) {
        // Like Lending: price and haircut per pledge, maximum loan amount = sum after haircut.
        let maximum = 0;
        stored.proposed_pledges = (doc.proposed_pledges as LendingDoc[]).map((row) => {
          const security = table("Loan Security").find((s) => s.name === row.loan_security) ?? {};
          const type = table("Loan Security Type").find((t) => t.name === security.loan_security_type) ?? {};
          const price = Number(table("Loan Security Price").find((p) => p.loan_security === row.loan_security)?.loan_security_price ?? 0);
          const haircut = Number(security.haircut || type.haircut || 0);
          const amount = Number(row.qty) * price;
          const postHaircut = Math.trunc(amount - (amount * haircut) / 100);
          maximum += postHaircut;
          return { ...row, loan_security_price: price, amount, haircut, post_haircut_amount: postHaircut };
        });
        stored.maximum_loan_amount = maximum;
      }
      table(doctype).push(stored);
      return structuredClone(stored);
    },
    addSecurity(code, type, ltv, price, valid) {
      if (!table("Loan Security Type").some((t) => t.name === type)) {
        table("Loan Security Type").push({ name: type, haircut: 100 - ltv, loan_to_value_ratio: ltv, disabled: 0 });
      }
      table("Loan Security").push({ name: code, loan_security_name: code, loan_security_type: type, haircut: 0, loan_to_value_ratio: 0, disabled: 0 });
      if (price !== undefined) {
        table("Loan Security Price").push({
          name: nextName("LM-LSP"),
          loan_security: code,
          loan_security_price: price,
          valid_from: valid?.from ?? "2000-01-01 00:00:00",
          valid_upto: valid?.upto ?? "2999-12-31 23:59:59"
        });
      }
    },
    addShortfall(loan, shortfallAmount, securityValue) {
      table("Loan Security Shortfall").push({
        name: nextName("LM-LSS"),
        loan,
        status: "Pending",
        shortfall_amount: shortfallAmount,
        security_value: securityValue,
        shortfall_time: "2026-10-03"
      });
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
      if (application.is_secured_loan && Array.isArray(application.proposed_pledges)) {
        // Lending pledges the proposed securities on the loan (Loan Security Assignment).
        const pledges = application.proposed_pledges as LendingDoc[];
        table("Loan Security Assignment").push({
          name: nextName("LM-LSA"),
          loan: loan.name,
          status: "Pledged",
          docstatus: 1,
          total_security_value: pledges.reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
          maximum_loan_value: pledges.reduce((sum, row) => sum + Number(row.post_haircut_amount ?? 0), 0)
        });
      }
      return String(loan.name);
    }
  };
}
