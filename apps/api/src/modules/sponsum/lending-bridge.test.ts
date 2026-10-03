import assert from "node:assert/strict";
import test from "node:test";

import {
  createHttpLendingTransport,
  LendingError,
  lendingConfigFromEnv,
  readLendingStatus,
  requestLoanApplication,
  type LendableCapitalNeed,
  type LendableReceivable,
  type LendingConfig
} from "./lending-bridge.js";
import { createLendingMock } from "./lending-mock.js";

const config: LendingConfig = {
  baseUrl: "https://erp.example.invalid",
  site: "erp.example.invalid",
  apiKey: "<API_KEY>",
  apiSecret: "<API_SECRET>",
  company: "Movena Test AG",
  loanProduct: "Forderungsfinanzierung Test"
};

const need = (overrides: Partial<LendableCapitalNeed> = {}): LendableCapitalNeed => ({
  need_id: "CAP-1",
  seeker_party_id: "customer:Nordholz AG",
  kind: "SHORT_DEBT",
  amount: "8000.00",
  currency: "CHF",
  status: "CONFIRMED",
  receivable_id: "SPN-1",
  ...overrides
});

const receivable = (overrides: Partial<LendableReceivable> = {}): LendableReceivable => ({
  receivable_id: "SPN-1",
  instrument_type: "ORDINARY_RECEIVABLE",
  status: "ACCEPTED",
  currency: "CHF",
  outstanding_amount: "10000.00",
  creditor_party_id: "customer:Nordholz AG",
  current_holder_party_id: "customer:Nordholz AG",
  invoice_id: "ACC-SINV-2026-00001",
  ...overrides
});

function setup() {
  const mock = createLendingMock();
  mock.addCustomer("Nordholz AG");
  return { mock, deps: { config, transport: mock, today: "2026-10-03" } };
}

async function rejectsWith(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof LendingError, `expected LendingError, got ${error}`);
    assert.equal(error.code, code);
    return true;
  });
}

test("config: null until loan product, company, URL and credentials exist (O1)", () => {
  const files: Record<string, string> = { "/run/secrets/lending": "abc:def\n", "/run/secrets/broken": "nocolon" };
  const read = (path: string) => {
    if (!(path in files)) throw new Error("ENOENT");
    return files[path];
  };
  const env = {
    MOVENA_LENDING_URL: "https://erp.example.invalid/",
    MOVENA_LENDING_COMPANY: "Movena Test AG",
    MOVENA_LENDING_LOAN_PRODUCT: "Forderungsfinanzierung Test",
    MOVENA_LENDING_CREDENTIALS_FILE: "/run/secrets/lending"
  };
  const parsed = lendingConfigFromEnv(env, read);
  assert.equal(parsed?.baseUrl, "https://erp.example.invalid");
  assert.equal(parsed?.apiKey, "abc");
  assert.equal(parsed?.apiSecret, "def");
  assert.equal(parsed?.site, null);
  assert.equal(lendingConfigFromEnv({ ...env, MOVENA_LENDING_LOAN_PRODUCT: "" }, read), null);
  assert.equal(lendingConfigFromEnv({ ...env, MOVENA_LENDING_CREDENTIALS_FILE: "/run/secrets/broken" }, read), null);
  assert.equal(lendingConfigFromEnv({ ...env, MOVENA_LENDING_CREDENTIALS_FILE: "/run/secrets/missing" }, read), null);
});

test("handover needs an explicit confirmation and a configured Lending", async () => {
  const { deps } = setup();
  await rejectsWith(requestLoanApplication({ need: need(), receivable: receivable() }, deps), "confirmation_required");
  await rejectsWith(
    requestLoanApplication({ need: need(), receivable: receivable(), confirm: true }, { config: null, transport: null }),
    "lending_not_configured"
  );
});

test("handover refuses what Sponsum does not allow, before anything is written", async () => {
  const cases: Array<[string, LendableCapitalNeed, LendableReceivable]> = [
    ["capital_need_not_confirmed", need({ status: "INTRODUCED" }), receivable()],
    ["capital_need_not_debt", need({ kind: "EQUITY" }), receivable()],
    ["capital_need_receivable_mismatch", need({ receivable_id: null }), receivable()],
    ["capital_need_receivable_mismatch", need({ receivable_id: "SPN-2" }), receivable()],
    ["wechsel_not_lendable", need(), receivable({ instrument_type: "LEGAL_BILL_OF_EXCHANGE" })],
    ["wechsel_not_lendable", need(), receivable({ instrument_type: "BITCREDIT_EBILL" })],
    ["receivable_not_lendable", need(), receivable({ status: "OFFERED" })],
    ["receivable_not_lendable", need(), receivable({ status: "DISPUTED" })],
    ["receivable_without_invoice", need(), receivable({ invoice_id: " " })],
    ["receivable_not_held_by_borrower", need(), receivable({ current_holder_party_id: "company:Käufer AG" })],
    ["receivable_not_held_by_borrower", need({ seeker_party_id: "customer:Andere AG" }), receivable()],
    [
      "borrower_not_customer",
      need({ seeker_party_id: "company:Movena Test AG" }),
      receivable({ creditor_party_id: "company:Movena Test AG", current_holder_party_id: "company:Movena Test AG" })
    ],
    ["currency_mismatch", need({ currency: "EUR" }), receivable()],
    ["invalid_amount", need({ amount: "8000,00" }), receivable()],
    ["invalid_amount", need({ amount: "0" }), receivable()],
    ["loan_amount_exceeds_receivable", need({ amount: "10000.01" }), receivable()]
  ];
  for (const [code, capitalNeed, asset] of cases) {
    const { mock, deps } = setup();
    await rejectsWith(requestLoanApplication({ need: capitalNeed, receivable: asset, confirm: true }, deps), code);
    assert.equal(mock.calls.filter((call) => call.op === "insert").length, 0, `${code}: nothing inserted`);
  }
});

test("handover refuses a borrower that is not an ERPNext customer", async () => {
  const { deps } = setup();
  const capitalNeed = need({ seeker_party_id: "customer:Unbekannt GmbH" });
  const asset = receivable({ creditor_party_id: "customer:Unbekannt GmbH", current_holder_party_id: "customer:Unbekannt GmbH" });
  await rejectsWith(requestLoanApplication({ need: capitalNeed, receivable: asset, confirm: true }, deps), "customer_not_found");
});

test("handover creates one draft Loan Application with Sponsum references only", async () => {
  const { mock, deps } = setup();
  const result = await requestLoanApplication({ need: need(), receivable: receivable(), confirm: true }, deps);
  assert.equal(result.created, true);
  assert.equal(result.loan, null);
  assert.equal(result.source, "LENDING · Loan Application");
  assert.equal(result.deep_link, `https://erp.example.invalid/desk/loan-application/${result.loan_application}`);

  const [application] = mock.docs.get("Loan Application")!;
  assert.equal(application.docstatus, 0);
  assert.deepEqual(Object.keys(application).sort(), [
    "applicant",
    "applicant_type",
    "company",
    "docstatus",
    "loan_amount",
    "loan_product",
    "movena_sponsum_capital_need_id",
    "movena_sponsum_receivable_id",
    "name",
    "posting_date",
    "status"
  ]);
  assert.equal(application.applicant_type, "Customer");
  assert.equal(application.applicant, "Nordholz AG");
  assert.equal(application.loan_product, "Forderungsfinanzierung Test");
  assert.equal(application.loan_amount, "8000.00");
  assert.equal(application.movena_sponsum_receivable_id, "SPN-1");
  assert.equal(application.movena_sponsum_capital_need_id, "CAP-1");
  // No rate, accounts or schedule from Sponsum: those belong to the Loan Product in Lending.
  for (const forbidden of ["rate_of_interest", "repayment_periods", "repayment_method", "loan_account", "payment_account"]) {
    assert.equal(forbidden in application, false, forbidden);
  }
});

test("handover is idempotent per receivable, also after the loan exists", async () => {
  const { mock, deps } = setup();
  const first = await requestLoanApplication({ need: need(), receivable: receivable(), confirm: true }, deps);
  const second = await requestLoanApplication({ need: need(), receivable: receivable(), confirm: true }, deps);
  assert.equal(second.created, false);
  assert.equal(second.loan_application, first.loan_application);
  assert.equal(mock.docs.get("Loan Application")!.length, 1);

  const loan = mock.approveAndCreateLoan(first.loan_application);
  const third = await requestLoanApplication(
    { need: need(), receivable: receivable({ status: "FINANCED" }), confirm: true },
    deps
  );
  assert.equal(third.created, false);
  assert.equal(third.loan, loan);
  assert.equal(third.source, "LENDING · Loan");
  assert.equal(mock.calls.filter((call) => call.op === "insert").length, 1);
});

test("a rejected application does not block a new one", async () => {
  const { mock, deps } = setup();
  const first = await requestLoanApplication({ need: need(), receivable: receivable(), confirm: true }, deps);
  mock.docs.get("Loan Application")![0].status = "Rejected";
  const second = await requestLoanApplication({ need: need(), receivable: receivable(), confirm: true }, deps);
  assert.equal(second.created, true);
  assert.notEqual(second.loan_application, first.loan_application);
});

test("status is read from Lending as it is: application, then loan with its next installment", async () => {
  const { mock, deps } = setup();
  assert.equal(await readLendingStatus("SPN-1", deps), null);

  const created = await requestLoanApplication({ need: need(), receivable: receivable(), confirm: true }, deps);
  const pending = await readLendingStatus("SPN-1", deps);
  assert.equal(pending?.stage, "APPLICATION");
  assert.equal(pending?.application?.name, created.loan_application);

  const loanName = mock.approveAndCreateLoan(created.loan_application, [
    { payment_date: "2026-09-30", total_payment: 2010.5 },
    { payment_date: "2026-11-30", total_payment: 2010.5 },
    { payment_date: "2026-10-31", total_payment: 2010.5 }
  ]);
  // The mapping carried the Sponsum reference from the application to the loan.
  assert.equal(mock.docs.get("Loan")![0].movena_sponsum_receivable_id, "SPN-1");

  const active = await readLendingStatus("SPN-1", deps);
  assert.equal(active?.stage, "LOAN");
  assert.equal(active?.source, "LENDING · Loan");
  assert.equal(active?.loan?.name, loanName);
  assert.equal(active?.loan?.status, "Disbursed");
  assert.equal(active?.loan?.disbursed_amount, "8000.00");
  assert.deepEqual(active?.next_installment, { payment_date: "2026-10-31", total_payment: 2010.5 });
  assert.equal(active?.deep_link, `https://erp.example.invalid/desk/loan/${loanName}`);
});

test("http transport: Frappe REST with token auth and site header", async () => {
  const seen: Array<{ url: string; init: RequestInit }> = [];
  const fakeFetch = (async (url: string, init: RequestInit) => {
    seen.push({ url, init });
    if (init.method === "POST") return new Response(JSON.stringify({ data: { name: "ACC-LOAP-2026-00001" } }), { status: 200 });
    if (url.includes("/Customer/")) return new Response(JSON.stringify({}), { status: 404 });
    return new Response(JSON.stringify({ data: [{ name: "X" }] }), { status: 200 });
  }) as unknown as typeof fetch;
  const transport = createHttpLendingTransport(config, fakeFetch);

  const rows = await transport.list("Loan Application", [["movena_sponsum_receivable_id", "=", "SPN-1"]], ["name"], 5);
  assert.deepEqual(rows, [{ name: "X" }]);
  const listUrl = new URL(seen[0].url);
  assert.equal(listUrl.pathname, "/api/resource/Loan%20Application");
  assert.deepEqual(JSON.parse(listUrl.searchParams.get("filters")!), [["movena_sponsum_receivable_id", "=", "SPN-1"]]);
  assert.equal(listUrl.searchParams.get("limit_page_length"), "5");
  const headers = seen[0].init.headers as Record<string, string>;
  assert.equal(headers.Authorization, "token <API_KEY>:<API_SECRET>");
  assert.equal(headers["X-Frappe-Site-Name"], "erp.example.invalid");

  assert.equal(await transport.get("Customer", "Nordholz AG"), null);
  const inserted = await transport.insert("Loan Application", { applicant: "Nordholz AG" });
  assert.equal(inserted.name, "ACC-LOAP-2026-00001");
  assert.deepEqual(JSON.parse(String(seen[2].init.body)), { applicant: "Nordholz AG" });
});

test("http transport: errors map to stable codes and never carry the credentials", async () => {
  const respond = (status: number, body: unknown) =>
    createHttpLendingTransport(config, (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch);
  const offline = createHttpLendingTransport(config, (async () => {
    throw new TypeError("fetch failed");
  }) as unknown as typeof fetch);

  for (const [transport, code] of [
    [offline, "lending_unreachable"],
    [respond(502, {}), "lending_unreachable"],
    [respond(401, {}), "lending_forbidden"],
    [respond(403, {}), "lending_forbidden"],
    [respond(417, { exception: "frappe.exceptions.ValidationError: Loan Product fehlt\nTraceback..." }), "lending_rejected"]
  ] as const) {
    await assert.rejects(transport.list("Loan", [], ["name"]), (error: unknown) => {
      assert.ok(error instanceof LendingError);
      assert.equal(error.code, code);
      assert.equal(error.message.includes("<API_SECRET>"), false);
      assert.equal(error.message.includes("Traceback"), false);
      return true;
    });
  }
});
