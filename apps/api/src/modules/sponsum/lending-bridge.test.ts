import assert from "node:assert/strict";
import test from "node:test";

import {
  createHttpLendingTransport,
  LendingError,
  assertCustodyReference,
  lendingConfigFromEnv,
  listLendingCustomers,
  listLombardSecurities,
  readLendingStatus,
  readLombardStatus,
  requestLombardApplication,
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

test("customers of the lending company: active ones, as customer:<name> ids, sorted", async () => {
  const { mock, deps } = setup();
  mock.addCustomer("Zeta Bau AG");
  mock.docs.get("Customer")!.push({ name: "Alt AG", customer_name: "Alt AG", disabled: 1 });
  const customers = await listLendingCustomers(deps);
  assert.deepEqual(
    customers.map((row) => row.id),
    ["customer:Nordholz AG", "customer:Zeta Bau AG"]
  );
  assert.equal(customers[0].name, "Nordholz AG");
  await rejectsWith(listLendingCustomers({ config: null, transport: null }), "lending_not_configured");
});

// O12 Lombard credit
function lombardSetup() {
  const mock = createLendingMock();
  mock.addCustomer("Nordholz AG");
  mock.addSecurity("BTC", "Kryptowährung", 50, 70000);
  mock.addSecurity("CH0012032048", "Wertschriften", 70, 250);
  mock.addSecurity("XAU", "Edelmetalle", 60);
  mock.addSecurity("OLD", "Kryptowährung", 50, 1, { from: "2026-01-01 00:00:00", upto: "2026-01-02 00:00:00" });
  const deps = { config: { ...config, lombardProduct: "Lombardkredit" }, transport: mock };
  return { mock, deps };
}

test("lombard securities: haircut/LTV from the type, only prices valid now", async () => {
  const { deps } = lombardSetup();
  const rows = await listLombardSecurities({ ...deps, now: new Date("2026-10-03T12:00:00Z") });
  const btc = rows.find((row) => row.code === "BTC")!;
  assert.deepEqual([btc.haircut, btc.loan_to_value_ratio, btc.price], [50, 50, 70000]);
  assert.equal(rows.find((row) => row.code === "CH0012032048")!.haircut, 30);
  assert.equal(rows.find((row) => row.code === "XAU")!.price, null);
  assert.equal(rows.find((row) => row.code === "OLD")!.price, null, "expired price is not used");
});

test("lombard request: checks collateral with Lending's prices, then one secured draft application", async () => {
  const { mock, deps } = lombardSetup();
  const base = { requestId: "lom-1", customerId: "customer:Nordholz AG", confirm: true, now: new Date("2026-10-03T12:00:00Z") };
  await rejectsWith(requestLombardApplication({ ...base, amount: "1000", pledges: [], confirm: undefined }, deps), "confirmation_required");
  await rejectsWith(requestLombardApplication({ ...base, amount: "1000", pledges: [] }, deps), "lombard_without_collateral");
  await rejectsWith(requestLombardApplication({ ...base, amount: "1000", pledges: [{ loan_security: "DOGE", qty: 1 }] }, deps), "lombard_security_unknown");
  await rejectsWith(requestLombardApplication({ ...base, amount: "1000", pledges: [{ loan_security: "XAU", qty: 1 }] }, deps), "lombard_security_without_price");
  await rejectsWith(requestLombardApplication({ ...base, amount: "1000", pledges: [{ loan_security: "BTC", qty: -1 }] }, deps), "invalid_amount");
  // 0.5 BTC x 70'000 x (1 - 50 %) = 17'500 + 100 x 250 x (1 - 30 %) = 17'500 -> 35'000 after haircut
  await rejectsWith(
    requestLombardApplication({ ...base, amount: "35000.01", pledges: [{ loan_security: "BTC", qty: 0.5 }, { loan_security: "CH0012032048", qty: 100 }] }, deps),
    "lombard_amount_exceeds_collateral"
  );
  await rejectsWith(requestLombardApplication({ ...base, customerId: "company:Movena GmbH", amount: "1000", pledges: [{ loan_security: "BTC", qty: 1 }] }, deps), "borrower_not_customer");
  assert.equal(mock.calls.filter((call) => call.op === "insert").length, 0);

  const result = await requestLombardApplication(
    { ...base, amount: "35000", pledges: [{ loan_security: "BTC", qty: 0.25 }, { loan_security: "BTC", qty: 0.25 }, { loan_security: "CH0012032048", qty: 100 }] },
    deps
  );
  assert.equal(result.created, true);
  assert.equal(result.collateral_value_after_haircut, 35000);
  const [application] = mock.docs.get("Loan Application")!;
  assert.equal(application.loan_product, "Lombardkredit");
  assert.equal(application.is_secured_loan, 1);
  assert.equal(application.movena_sponsum_capital_need_id, "lom-1");
  assert.deepEqual(
    (application.proposed_pledges as Array<{ loan_security: string; qty: number }>).map((row) => [row.loan_security, row.qty]),
    [["BTC", 0.5], ["CH0012032048", 100]],
    "same security merged"
  );
  assert.equal(application.maximum_loan_amount, 35000, "Lending's own maximum matches the pre-check");

  const again = await requestLombardApplication({ ...base, amount: "35000", pledges: [{ loan_security: "BTC", qty: 0.5 }] }, deps);
  assert.equal(again.created, false);
  assert.equal(mock.docs.get("Loan Application")!.length, 1);

  await rejectsWith(
    requestLombardApplication({ ...base, requestId: "lom-2", amount: "1000", pledges: [{ loan_security: "BTC", qty: 1 }] }, { ...deps, config: { ...deps.config, lombardProduct: null } }),
    "lending_not_configured"
  );
});

test("lombard status: pledges and maximum from Lending, then loan, security value and shortfall", async () => {
  const { mock, deps } = lombardSetup();
  assert.equal(await readLombardStatus("lom-1", deps), null);
  const created = await requestLombardApplication(
    { requestId: "lom-1", customerId: "customer:Nordholz AG", amount: "20000", pledges: [{ loan_security: "BTC", qty: 1 }], confirm: true, now: new Date("2026-10-03T12:00:00Z") },
    deps
  );
  const pending = await readLombardStatus("lom-1", deps);
  assert.equal(pending?.stage, "APPLICATION");
  assert.equal(pending?.application?.maximum_loan_amount, 35000);
  assert.deepEqual(pending?.pledges.map((row) => [row.loan_security, row.post_haircut_amount]), [["BTC", 35000]]);

  const loan = mock.approveAndCreateLoan(created.loan_application);
  mock.addShortfall(loan, 1500, 30000);
  const active = await readLombardStatus("lom-1", deps);
  assert.equal(active?.stage, "LOAN");
  assert.equal(active?.loan?.name, loan);
  assert.deepEqual([active?.security?.total_security_value, active?.security?.maximum_loan_value], [70000, 35000]);
  assert.deepEqual([active?.shortfall?.shortfall_amount, active?.shortfall?.security_value], [1500, 30000]);
});

test("custody reference: public addresses, descriptors and depot numbers yes, keys and seeds never", () => {
  for (const ok of [
    "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
    "wsh(multi(2,xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWKiKrhko4egpiMZbpiaQL2jkwSB1icqYh2cfDfVxdx4df189oLKnC5fSwqPfgyP3hooxujYzAu3fDVmz,xpub68NZiKmJWnxxS6aaHmn81bvJeTESw724CRDs6HbuccFQN9Ku14VQrADWgqbhhTHBaohPX4CjNLf9fq9MYo6oDaPPLPxSb7gwQN3ih19Zm4Y))",
    "Depot 0815-123456.01 bei Treuhand AG"
  ]) {
    assert.equal(assertCustodyReference(ok), ok);
  }
  for (const bad of [
    "",
    "xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi",
    "5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ",
    "e9873d79c6d87dc0fb6a5778633389f4453213303da61f20bd67fc233aa33262",
    "abandon ability able about above absent absorb abstract absurd abuse access accident"
  ]) {
    assert.throws(() => assertCustodyReference(bad), (error: unknown) => error instanceof LendingError && error.code === "custody_reference_invalid", bad.slice(0, 12));
  }
});
