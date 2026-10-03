/**
 * Bridge from Sponsum to Frappe Lending on erp.movena.ch (wave 3, mock-first).
 *
 * Lending runs the loan contract, Sponsum keeps the receivable, its holder and the capital need, ERPNext keeps
 * customer, invoice and bookings (movena-suite: docs/architecture/frappe-lending.md). Sponsum never computes
 * interest, schedules or balances: it creates at most one draft Loan Application per receivable and reads the loan's
 * status from Lending, live. Amounts shown come from Lending as they are.
 *
 * Lending models the ERPNext company as the lender. The borrower is the creditor who seeks capital (O6) and must be
 * an ERPNext Customer (`customer:<name>`); Wechsel never become loans (O3).
 *
 * Self-contained on purpose (no import from store.ts or @sponsum/shared), so it can be committed apart from the
 * uncommitted desk work. Wiring into capital needs (status CONFIRMED, route, desk) follows once that work is
 * committed (O9); the live connection needs the technical ERPNext user (O8). See docs/lending.md.
 */
import { readFileSync } from "node:fs";

export type LendingErrorCode =
  | "lending_not_configured"
  | "lending_unreachable"
  | "lending_forbidden"
  | "lending_rejected"
  | "confirmation_required"
  | "capital_need_not_confirmed"
  | "capital_need_not_debt"
  | "capital_need_receivable_mismatch"
  | "wechsel_not_lendable"
  | "receivable_not_lendable"
  | "receivable_without_invoice"
  | "receivable_not_held_by_borrower"
  | "borrower_not_customer"
  | "customer_not_found"
  | "currency_mismatch"
  | "invalid_amount"
  | "loan_amount_exceeds_receivable";

export class LendingError extends Error {
  constructor(
    readonly code: LendingErrorCode,
    message: string
  ) {
    super(message);
    this.name = "LendingError";
  }
}

export type LendingConfig = {
  baseUrl: string;
  site: string | null;
  apiKey: string;
  apiSecret: string;
  company: string;
  loanProduct: string;
};

/**
 * MOVENA_LENDING_URL, MOVENA_LENDING_SITE (optional), MOVENA_LENDING_CREDENTIALS_FILE (one line `<key>:<secret>`
 * of the technical ERPNext user, never in the repo), MOVENA_LENDING_COMPANY, MOVENA_LENDING_LOAN_PRODUCT.
 * Returns null while anything is missing: the loan product and accounts are not decided yet (O1).
 */
export function lendingConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  readFile: (path: string) => string = (path) => readFileSync(path, "utf8")
): LendingConfig | null {
  const baseUrl = (env.MOVENA_LENDING_URL ?? "").trim().replace(/\/+$/, "");
  const company = (env.MOVENA_LENDING_COMPANY ?? "").trim();
  const loanProduct = (env.MOVENA_LENDING_LOAN_PRODUCT ?? "").trim();
  const credentialsFile = (env.MOVENA_LENDING_CREDENTIALS_FILE ?? "").trim();
  if (!baseUrl || !company || !loanProduct || !credentialsFile) return null;
  let credentials = "";
  try {
    credentials = readFile(credentialsFile).trim();
  } catch {
    return null;
  }
  const separator = credentials.indexOf(":");
  if (separator <= 0 || separator === credentials.length - 1) return null;
  return {
    baseUrl,
    site: (env.MOVENA_LENDING_SITE ?? "").trim() || null,
    apiKey: credentials.slice(0, separator),
    apiSecret: credentials.slice(separator + 1),
    company,
    loanProduct
  };
}

export type LendingFilter = [string, "=" | "!=", string | number];
export type LendingDoc = Record<string, unknown>;

/** The slice of the Frappe REST API Sponsum uses. Implemented over HTTP and in-memory (lending-mock.ts). */
export type LendingTransport = {
  list(doctype: string, filters: LendingFilter[], fields: string[], limit?: number): Promise<LendingDoc[]>;
  get(doctype: string, name: string): Promise<LendingDoc | null>;
  insert(doctype: string, doc: LendingDoc): Promise<LendingDoc>;
};

export function createHttpLendingTransport(
  config: LendingConfig,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 10_000
): LendingTransport {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `token ${config.apiKey}:${config.apiSecret}`
  };
  if (config.site) headers["X-Frappe-Site-Name"] = config.site;

  async function call(method: "GET" | "POST", path: string, body?: unknown): Promise<{ status: number; json: any }> {
    let response: Response;
    try {
      response = await fetchImpl(`${config.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch {
      throw new LendingError("lending_unreachable", "Frappe Lending ist nicht erreichbar.");
    }
    const json = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) {
      throw new LendingError("lending_forbidden", "Frappe Lending verweigert den Zugriff für den technischen Benutzer.");
    }
    if (response.status >= 500) {
      throw new LendingError("lending_unreachable", `Frappe Lending antwortet mit Fehler ${response.status}.`);
    }
    return { status: response.status, json };
  }

  function rejected(status: number, json: any): LendingError {
    const detail = typeof json?.exception === "string" ? json.exception.split("\n")[0].slice(0, 200) : `HTTP ${status}`;
    return new LendingError("lending_rejected", `Frappe Lending lehnt die Anfrage ab: ${detail}`);
  }

  const resource = (doctype: string) => `/api/resource/${encodeURIComponent(doctype)}`;

  return {
    async list(doctype, filters, fields, limit = 20) {
      const query = new URLSearchParams({
        filters: JSON.stringify(filters),
        fields: JSON.stringify(fields),
        limit_page_length: String(limit)
      });
      const { status, json } = await call("GET", `${resource(doctype)}?${query}`);
      if (status !== 200) throw rejected(status, json);
      return Array.isArray(json?.data) ? json.data : [];
    },
    async get(doctype, name) {
      const { status, json } = await call("GET", `${resource(doctype)}/${encodeURIComponent(name)}`);
      if (status === 404) return null;
      if (status !== 200) throw rejected(status, json);
      return json?.data ?? null;
    },
    async insert(doctype, doc) {
      const { status, json } = await call("POST", resource(doctype), doc);
      if (status !== 200) throw rejected(status, json);
      return json?.data ?? {};
    }
  };
}

/** What the handover needs from a capital need; structurally a CapitalNeed once it knows CONFIRMED (O5). */
export type LendableCapitalNeed = {
  need_id: string;
  seeker_party_id: string;
  kind: string;
  amount: string;
  currency: string;
  status: string;
  receivable_id: string | null;
};

/** What the handover needs from a ReceivableAsset (@sponsum/shared). */
export type LendableReceivable = {
  receivable_id: string;
  instrument_type: string;
  status: string;
  currency: string;
  outstanding_amount: string;
  creditor_party_id: string;
  current_holder_party_id: string;
  invoice_id: string;
};

export const LENDABLE_CAPITAL_KINDS = ["SHORT_DEBT", "LONG_DEBT"] as const;
export const LENDABLE_RECEIVABLE_STATUSES = ["VERIFIED", "ACCEPTED", "PARTIALLY_PAID"] as const;
/** O3: Wechsel (legal and Bitcredit e-bill) never become loans. */
export const WECHSEL_INSTRUMENTS = ["LEGAL_BILL_OF_EXCHANGE", "BITCREDIT_EBILL"] as const;

export const SPONSUM_RECEIVABLE_FIELD = "movena_sponsum_receivable_id";
export const SPONSUM_CAPITAL_NEED_FIELD = "movena_sponsum_capital_need_id";

export type LendingDeps = {
  config: LendingConfig | null;
  transport: LendingTransport | null;
  today?: string;
};

export type LoanApplicationResult = {
  created: boolean;
  loan_application: string;
  loan: string | null;
  deep_link: string;
  source: "LENDING · Loan Application" | "LENDING · Loan";
};

function cents(value: string, label: string): bigint {
  const trimmed = String(value ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new LendingError("invalid_amount", `${label} ist kein gültiger Betrag.`);
  }
  const [whole, fraction = ""] = trimmed.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}

function customerFromParty(partyId: string): string | null {
  return partyId.startsWith("customer:") && partyId.length > "customer:".length ? partyId.slice("customer:".length) : null;
}

function requireConfigured(deps: LendingDeps): { config: LendingConfig; transport: LendingTransport } {
  if (!deps.config || !deps.transport) {
    throw new LendingError(
      "lending_not_configured",
      "Frappe Lending ist nicht eingerichtet (Kreditprodukt, Firma oder technischer Benutzer fehlen)."
    );
  }
  return { config: deps.config, transport: deps.transport };
}

const deskLink = (config: LendingConfig, route: "loan" | "loan-application", name: string) =>
  `${config.baseUrl}/desk/${route}/${encodeURIComponent(name)}`;

/** Checks everything Sponsum owns before Lending is touched. Returns the ERPNext Customer of the borrower. */
export function assertLendable(need: LendableCapitalNeed, receivable: LendableReceivable): string {
  if (need.status !== "CONFIRMED") {
    throw new LendingError("capital_need_not_confirmed", "Nur ein bestätigter Kapitalbedarf kann einen Kreditantrag auslösen.");
  }
  if (!(LENDABLE_CAPITAL_KINDS as readonly string[]).includes(need.kind)) {
    throw new LendingError("capital_need_not_debt", "Eigenkapitalbedarf wird nicht über Frappe Lending abgewickelt.");
  }
  if (!need.receivable_id || need.receivable_id !== receivable.receivable_id) {
    throw new LendingError("capital_need_receivable_mismatch", "Der Kapitalbedarf ist nicht mit dieser Forderung verknüpft.");
  }
  if ((WECHSEL_INSTRUMENTS as readonly string[]).includes(receivable.instrument_type)) {
    throw new LendingError("wechsel_not_lendable", "Wechsel werden nicht zu Krediten.");
  }
  if (!(LENDABLE_RECEIVABLE_STATUSES as readonly string[]).includes(receivable.status)) {
    throw new LendingError(
      "receivable_not_lendable",
      `Die Forderung ist im Status ${receivable.status} und kann nicht finanziert werden.`
    );
  }
  if (!receivable.invoice_id?.trim()) {
    throw new LendingError("receivable_without_invoice", "Die Forderung hat keine ERPNext-Rechnung.");
  }
  if (
    receivable.creditor_party_id !== need.seeker_party_id ||
    receivable.current_holder_party_id !== receivable.creditor_party_id
  ) {
    throw new LendingError(
      "receivable_not_held_by_borrower",
      "Kreditnehmer muss Gläubiger und aktueller Halter der Forderung sein."
    );
  }
  const customer = customerFromParty(need.seeker_party_id);
  if (!customer) {
    throw new LendingError("borrower_not_customer", "Kreditnehmer muss in ERPNext als Kunde geführt sein.");
  }
  if (need.currency !== receivable.currency) {
    throw new LendingError("currency_mismatch", "Kapitalbedarf und Forderung haben unterschiedliche Währungen.");
  }
  if (cents(need.amount, "Kreditbetrag") <= 0n) {
    throw new LendingError("invalid_amount", "Kreditbetrag muss grösser als null sein.");
  }
  if (cents(need.amount, "Kreditbetrag") > cents(receivable.outstanding_amount, "Offener Forderungsbetrag")) {
    throw new LendingError("loan_amount_exceeds_receivable", "Kreditbetrag übersteigt den offenen Forderungsbetrag.");
  }
  return customer;
}

async function existingForReceivable(
  transport: LendingTransport,
  receivableId: string
): Promise<{ application: LendingDoc | null; loan: LendingDoc | null }> {
  const byReceivable: LendingFilter[] = [
    [SPONSUM_RECEIVABLE_FIELD, "=", receivableId],
    ["docstatus", "!=", 2]
  ];
  const [applications, loans] = await Promise.all([
    transport.list("Loan Application", byReceivable, ["name", "status", "docstatus"], 5),
    transport.list(
      "Loan",
      byReceivable,
      ["name", "status", "docstatus", "loan_amount", "disbursed_amount", "total_amount_paid", "total_payment"],
      5
    )
  ]);
  const open = (docs: LendingDoc[]) =>
    docs.find((doc) => !["Rejected", "Closed", "Settled", "Written Off"].includes(String(doc.status ?? ""))) ?? null;
  return { application: open(applications), loan: open(loans) };
}

/**
 * Creates the draft Loan Application for a confirmed capital need, or returns the open one that already exists for
 * the receivable (idempotent). Rate, schedule and accounts come from the Loan Product in Lending, never from Sponsum.
 */
export async function requestLoanApplication(
  input: { need: LendableCapitalNeed; receivable: LendableReceivable; confirm?: boolean },
  deps: LendingDeps
): Promise<LoanApplicationResult> {
  if (input.confirm !== true) {
    throw new LendingError("confirmation_required", "Kreditantrag braucht eine explizite Bestätigung.");
  }
  const { config, transport } = requireConfigured(deps);

  // Idempotent first: a repeated call returns what Lending already has for the receivable, even when the receivable
  // has moved on in Sponsum since (e.g. FINANCED). Eligibility only gates creating something new.
  const existing = await existingForReceivable(transport, input.receivable.receivable_id);
  if (existing.loan) {
    const loan = String(existing.loan.name);
    return { created: false, loan_application: String(existing.application?.name ?? ""), loan, deep_link: deskLink(config, "loan", loan), source: "LENDING · Loan" };
  }
  if (existing.application) {
    const name = String(existing.application.name);
    return { created: false, loan_application: name, loan: null, deep_link: deskLink(config, "loan-application", name), source: "LENDING · Loan Application" };
  }

  const customer = assertLendable(input.need, input.receivable);
  if (!(await transport.get("Customer", customer))) {
    throw new LendingError("customer_not_found", `Kunde ${customer} existiert in ERPNext nicht.`);
  }
  const created = await transport.insert("Loan Application", {
    applicant_type: "Customer",
    applicant: customer,
    company: config.company,
    loan_product: config.loanProduct,
    loan_amount: input.need.amount,
    ...(deps.today ? { posting_date: deps.today } : {}),
    [SPONSUM_RECEIVABLE_FIELD]: input.receivable.receivable_id,
    [SPONSUM_CAPITAL_NEED_FIELD]: input.need.need_id
  });
  const name = String(created.name ?? "");
  return { created: true, loan_application: name, loan: null, deep_link: deskLink(config, "loan-application", name), source: "LENDING · Loan Application" };
}

export type LendingStatus = {
  stage: "APPLICATION" | "LOAN";
  application: { name: string; status: string } | null;
  loan: {
    name: string;
    status: string;
    loan_amount: unknown;
    disbursed_amount: unknown;
    total_amount_paid: unknown;
    total_payment: unknown;
  } | null;
  next_installment: { payment_date: string; total_payment: unknown } | null;
  source: "LENDING · Loan Application" | "LENDING · Loan";
  deep_link: string;
};

export type LendingCustomer = { id: string; name: string; erp_name: string; kind: "customer" };

/**
 * Active ERPNext customers of the lending company, live via the technical user (read-only on Customer). They are the
 * possible borrowers (O6): Movena finances its customers' receivables. Nothing is stored in Sponsum.
 */
export async function listLendingCustomers(deps: LendingDeps, limit = 500): Promise<LendingCustomer[]> {
  const { transport } = requireConfigured(deps);
  const rows = await transport.list("Customer", [["disabled", "=", 0]], ["name", "customer_name"], limit);
  return rows
    .map((row) => {
      const erpName = String(row.name ?? "");
      return { id: `customer:${erpName}`, name: String(row.customer_name || erpName), erp_name: erpName, kind: "customer" as const };
    })
    .filter((row) => row.erp_name)
    .sort((a, b) => a.name.localeCompare(b.name, "de-CH"));
}

/** Read-only status for the receivable, live from Lending. Null when Lending has nothing for it. */
export async function readLendingStatus(receivableId: string, deps: LendingDeps): Promise<LendingStatus | null> {
  const { config, transport } = requireConfigured(deps);
  const existing = await existingForReceivable(transport, receivableId);
  if (existing.loan) {
    const loan = existing.loan;
    const name = String(loan.name);
    let nextInstallment: LendingStatus["next_installment"] = null;
    const schedules = await transport.list(
      "Loan Repayment Schedule",
      [
        ["loan", "=", name],
        ["status", "=", "Active"],
        ["docstatus", "=", 1]
      ],
      ["name"],
      1
    );
    if (schedules[0]) {
      const schedule = await transport.get("Loan Repayment Schedule", String(schedules[0].name));
      const today = deps.today ?? new Date().toISOString().slice(0, 10);
      const rows = Array.isArray(schedule?.repayment_schedule) ? (schedule.repayment_schedule as LendingDoc[]) : [];
      const next = rows
        .filter((row) => String(row.payment_date ?? "") >= today)
        .sort((a, b) => String(a.payment_date).localeCompare(String(b.payment_date)))[0];
      if (next) nextInstallment = { payment_date: String(next.payment_date), total_payment: next.total_payment };
    }
    return {
      stage: "LOAN",
      application: existing.application ? { name: String(existing.application.name), status: String(existing.application.status ?? "") } : null,
      loan: {
        name,
        status: String(loan.status ?? ""),
        loan_amount: loan.loan_amount,
        disbursed_amount: loan.disbursed_amount,
        total_amount_paid: loan.total_amount_paid,
        total_payment: loan.total_payment
      },
      next_installment: nextInstallment,
      source: "LENDING · Loan",
      deep_link: deskLink(config, "loan", name)
    };
  }
  if (existing.application) {
    const name = String(existing.application.name);
    return {
      stage: "APPLICATION",
      application: { name, status: String(existing.application.status ?? "") },
      loan: null,
      next_installment: null,
      source: "LENDING · Loan Application",
      deep_link: deskLink(config, "loan-application", name)
    };
  }
  return null;
}
