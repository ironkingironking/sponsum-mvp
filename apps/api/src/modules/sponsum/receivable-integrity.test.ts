import assert from "node:assert/strict";
import test from "node:test";
import { DomainError } from "@sponsum/shared";
import { inScope, type Principal } from "./access-context.js";
import type { LendingConfig } from "./lending-bridge.js";
import { createLendingMock } from "./lending-mock.js";
import { MemorySponsumStore } from "./store.js";
import { SponsumService } from "./service.js";
import { setSponsumToday } from "./clock.js";

// Fixtures use maturity dates in autumn 2026; pin «today» so they are not overdue (SPO-03).
setSponsumToday(() => "2026-09-01");

// DK-31 (audit 2026-10-08): a receivable is sold or financed at most once.

const alice: Principal = { tenantId: "tenant-a", userId: "alice", email: "alice@example.test", admin: true, legacyTenant: "tenant-a" };
const charlie: Principal = { tenantId: "tenant-b", userId: "charlie", email: "charlie@example.test", admin: true, legacyTenant: "tenant-a" };

const domainCode = (code: string) => (error: unknown) => error instanceof DomainError && error.code === code;

function input(invoice: string, creditor: string) {
  return {
    invoice_id: invoice,
    nominal_amount: "1200",
    issue_date: "2026-09-01",
    maturity_date: "2026-10-01",
    creditor_party_id: creditor,
    debtor_party_id: "customer:Debitor AG"
  };
}

test("the same invoice of the same ERPNext creditor is refused in a second tenant", () => {
  const service = new SponsumService(new MemorySponsumStore());
  inScope(alice, () => service.createReceivable(input("RE-100", "customer:Nordholz AG")));
  assert.throws(
    () => inScope(charlie, () => service.createReceivable(input(" re-100 ", "customer:Nordholz AG"))),
    domainCode("duplicate_invoice")
  );
  // Swiss UID written differently is the same creditor.
  inScope(alice, () => service.createReceivable(input("RE-200", "CHE-123.456.789")));
  assert.throws(
    () => inScope(charlie, () => service.createReceivable(input("RE-200", "che123456789"))),
    domainCode("duplicate_invoice")
  );
  // Another creditor may use the same invoice number.
  assert.ok(inScope(charlie, () => service.createReceivable(input("RE-100", "customer:Alpine AG"))).receivable_id);
});

test("tenant-local placeholder creditors stay tenant-scoped; the same tenant still refuses duplicates", () => {
  const service = new SponsumService(new MemorySponsumStore());
  inScope(alice, () => service.createReceivable(input("RE-1", "seller-ui")));
  assert.ok(inScope(charlie, () => service.createReceivable(input("RE-1", "seller-ui"))).receivable_id);
  assert.throws(
    () => inScope(alice, () => service.createReceivable(input("RE-1", "seller-other"))),
    domainCode("duplicate_invoice")
  );
});

const config: LendingConfig = {
  baseUrl: "https://erp.example.invalid",
  site: null,
  apiKey: "<API_KEY>",
  apiSecret: "<API_SECRET>",
  company: "Movena Test AG",
  loanProduct: "Forderungsfinanzierung Test"
};
const SEEKER = "customer:Nordholz AG";
const FULL = {
  hasInvoice: true,
  invoiceElectronic: true,
  hasContract: true,
  hasDelivery: true,
  unpaid: true,
  hasDispute: false,
  creditorKyc: true,
  debtorKyc: true
};

function erp(service: SponsumService) {
  const mock = createLendingMock();
  mock.addCustomer("Nordholz AG");
  mock.addSalesInvoice({
    name: "ACC-SINV-2026-00012",
    customer: "Debitor AG",
    company: "Movena Test AG",
    currency: "CHF",
    grand_total: 5400,
    outstanding_amount: 5400,
    posting_date: "2026-09-01",
    due_date: "2026-10-31"
  });
  service.setLendingDeps(() => ({ config, transport: mock, today: "2026-10-08" }));
  return mock;
}

function linked(service: SponsumService, creditor = SEEKER) {
  return service.submitReceivable({
    invoice_id: "typed-by-user",
    sales_invoice: "ACC-SINV-2026-00012",
    nominal_amount: "999999",
    issue_date: "2020-01-01",
    maturity_date: "2020-03-08",
    creditor_party_id: creditor,
    debtor_party_id: "customer:Debitor AG",
    evidence: FULL
  });
}

test("a receivable from a Sales Invoice takes amount, currency and dates from ERPNext, not from the request", async () => {
  const service = new SponsumService();
  erp(service);
  const asset = await linked(service);
  assert.equal(asset.sales_invoice, "ACC-SINV-2026-00012");
  assert.equal(asset.invoice_id, "ACC-SINV-2026-00012");
  assert.equal(asset.nominal_amount, "5400.00");
  assert.equal(asset.outstanding_amount, "5400.00");
  assert.equal(asset.issue_date, "2026-09-01");
  assert.equal(asset.maturity_date, "2026-10-31");
  // The same Sales Invoice is never registered twice, not even by another tenant.
  await assert.rejects(inScope(charlie, () => linked(service, "customer:Alpine AG")), domainCode("duplicate_invoice"));
});

test("only a submitted, open Sales Invoice becomes a receivable; without ERPNext the check fails closed", async () => {
  const cases: Array<[Record<string, unknown>, string]> = [
    [{ docstatus: 0 }, "invoice_not_open"],
    [{ docstatus: 2 }, "invoice_not_open"],
    [{ outstanding_amount: 0 }, "invoice_not_open"],
    [{ is_return: 1, outstanding_amount: -5400 }, "invoice_not_open"],
    [{ customer: "Andere AG" }, "invoice_party_mismatch"]
  ];
  for (const [change, code] of cases) {
    const service = new SponsumService();
    erp(service).addSalesInvoice({ name: "ACC-SINV-2026-00012", ...change });
    await assert.rejects(linked(service), domainCode(code), JSON.stringify(change));
    assert.equal(service.listReceivables().length, 0);
  }
  const service = new SponsumService();
  erp(service);
  await assert.rejects(service.submitReceivable({ ...input("x", SEEKER), sales_invoice: "ACC-SINV-missing" }), domainCode("invoice_not_found"));
  service.setLendingDeps(() => ({ config: null, transport: null }));
  await assert.rejects(linked(service), domainCode("erp_unavailable"));
  // The synchronous path cannot skip the live check.
  assert.throws(() => service.createReceivable({ ...input("x", SEEKER), sales_invoice: "ACC-SINV-2026-00012" }), domainCode("invoice_check_required"));
});

test("offer and sale re-check the Sales Invoice: paid or cancelled in ERPNext means no offer", async () => {
  const service = new SponsumService();
  const mock = erp(service);
  service.setKyc(SEEKER, "PASSED");
  const created = await linked(service);
  // ERPNext belegt Rechnung und offenen Betrag; Vertrag, Lieferung und KYC bestätigt erst eine Person (SPO-02).
  assert.equal(created.status, "VERIFIED");
  const asset = service.verify(created.receivable_id, FULL);
  assert.equal(asset.status, "ACCEPTED");
  // Without the live check the step refuses to run.
  assert.throws(() => service.createOffer(asset.receivable_id, { seller_party_id: SEEKER }), domainCode("invoice_check_required"));

  mock.addSalesInvoice({ name: "ACC-SINV-2026-00012", outstanding_amount: 0 });
  await assert.rejects(
    service.withCheckedInvoice(asset.receivable_id, () => service.createOffer(asset.receivable_id, { seller_party_id: SEEKER })),
    domainCode("invoice_not_open")
  );
  mock.addSalesInvoice({ name: "ACC-SINV-2026-00012", outstanding_amount: 3000, due_date: "2026-11-15" });
  const offer = await service.withCheckedInvoice(asset.receivable_id, () =>
    service.createOffer(asset.receivable_id, { seller_party_id: SEEKER, min_price: "2900" })
  );
  assert.equal(offer.status, "LIVE");
  // A part payment in ERPNext lowers what is sold.
  assert.equal(service.getReceivable(asset.receivable_id).outstanding_amount, "3000.00");
  assert.equal(service.getReceivable(asset.receivable_id).maturity_date, "2026-11-15");

  service.setKyc("buyer-1", "PASSED");
  const bid = service.createBid(offer.offer_id, "buyer-1", "2950");
  mock.addSalesInvoice({ name: "ACC-SINV-2026-00012", docstatus: 2 });
  await assert.rejects(
    service.withCheckedInvoice(service.receivableOfBid(bid.bid_id), () => service.acceptBid(bid.bid_id, SEEKER)),
    domainCode("invoice_not_open")
  );
});

test("confirmation and loan re-check the Sales Invoice; a paid invoice creates no Loan Application", async () => {
  const service = new SponsumService();
  const mock = erp(service);
  const asset = await linked(service);
  const { need } = service.createCapitalNeed({ seeker_party_id: SEEKER, kind: "SHORT_DEBT", amount: "5000", tenor_months: 6 });
  assert.throws(
    () => service.confirmCapitalNeed(need.need_id, { receivable_id: asset.receivable_id, confirm: true }),
    domainCode("invoice_check_required")
  );
  await service.withCheckedInvoice(asset.receivable_id, () =>
    service.confirmCapitalNeed(need.need_id, { receivable_id: asset.receivable_id, confirm: true })
  );
  // Part payment after the confirmation: the loan may not exceed what ERPNext still shows as open.
  mock.addSalesInvoice({ name: "ACC-SINV-2026-00012", outstanding_amount: 4000 });
  await assert.rejects(service.requestCapitalNeedLoan(need.need_id, { confirm: true }), domainCode("loan_amount_exceeds_receivable"));
  mock.addSalesInvoice({ name: "ACC-SINV-2026-00012", outstanding_amount: 0 });
  await assert.rejects(service.requestCapitalNeedLoan(need.need_id, { confirm: true }), domainCode("invoice_not_open"));
  assert.equal((mock.docs.get("Loan Application") ?? []).length, 0);
  mock.addSalesInvoice({ name: "ACC-SINV-2026-00012", outstanding_amount: 5400 });
  assert.equal((await service.requestCapitalNeedLoan(need.need_id, { confirm: true })).created, true);
});

function unlinked(service: SponsumService, creditor = SEEKER) {
  return service.createReceivable({ ...input(`RE-${Math.random().toString(16).slice(2, 8)}`, creditor), evidence: FULL });
}

test("a receivable reserved for financing cannot be offered or sold", () => {
  const service = new SponsumService();
  const boss: Principal = { tenantId: "t1", userId: "boss", email: "boss@example.test", admin: true, legacyTenant: "t1" };
  const member: Principal = { ...boss, userId: "member", email: "member@example.test", admin: false };
  const asset = inScope(boss, () => unlinked(service), "write");
  inScope(boss, () => service.setKyc(SEEKER, "PASSED"), "write");
  // The need belongs to another user of the tenant; the guard looks at the whole store.
  const need = inScope(member, () => service.createCapitalNeed({ seeker_party_id: SEEKER, kind: "SHORT_DEBT", amount: "1000", tenor_months: 6 }).need, "write");
  inScope(boss, () => service.confirmCapitalNeed(need.need_id, { receivable_id: asset.receivable_id, confirm: true }), "write");
  const steps: Array<() => unknown> = [
    () => service.createOffer(asset.receivable_id, { seller_party_id: SEEKER }),
    () => service.requestLiquidity(asset.receivable_id, SEEKER),
    () => service.createAssignment({ receivable_id: asset.receivable_id, seller_party_id: SEEKER, buyer_party_id: "buyer-1", purchase_price: "900" })
  ];
  for (const step of steps) {
    assert.throws(() => inScope(boss, step, "write"), domainCode("receivable_encumbered"));
  }
});

test("an offered or sold receivable cannot be linked to a capital need", () => {
  const service = new SponsumService();
  service.setKyc(SEEKER, "PASSED");
  const asset = unlinked(service);
  service.createOffer(asset.receivable_id, { seller_party_id: SEEKER, min_price: "1000" });
  const { need } = service.createCapitalNeed({ seeker_party_id: SEEKER, kind: "SHORT_DEBT", amount: "1000", tenor_months: 6 });
  assert.throws(
    () => service.confirmCapitalNeed(need.need_id, { receivable_id: asset.receivable_id, confirm: true }),
    domainCode("receivable_encumbered")
  );
  // A second need cannot reserve the same receivable either.
  const free = unlinked(service);
  const first = service.createCapitalNeed({ seeker_party_id: SEEKER, kind: "SHORT_DEBT", amount: "500", tenor_months: 6 }).need;
  service.confirmCapitalNeed(first.need_id, { receivable_id: free.receivable_id, confirm: true });
  const second = service.createCapitalNeed({ seeker_party_id: SEEKER, kind: "SHORT_DEBT", amount: "500", tenor_months: 6 }).need;
  assert.throws(
    () => service.confirmCapitalNeed(second.need_id, { receivable_id: free.receivable_id, confirm: true }),
    domainCode("receivable_encumbered")
  );
});

test("withdrawing a need keeps the reservation while Lending has an open application", async () => {
  const service = new SponsumService();
  const mock = erp(service);
  service.setKyc(SEEKER, "PASSED");
  const asset = unlinked(service);
  const { need } = service.createCapitalNeed({ seeker_party_id: SEEKER, kind: "SHORT_DEBT", amount: "1000", tenor_months: 6 });
  service.confirmCapitalNeed(need.need_id, { receivable_id: asset.receivable_id, confirm: true });
  const loan = await service.requestCapitalNeedLoan(need.need_id, { confirm: true });
  await assert.rejects(service.withdrawCapitalNeed(need.need_id), domainCode("receivable_encumbered"));
  assert.throws(() => service.createOffer(asset.receivable_id, { seller_party_id: SEEKER }), domainCode("receivable_encumbered"));
  // Lending rejects the application: the need can be withdrawn and the receivable is free again.
  Object.assign(mock.docs.get("Loan Application")!.find((doc) => doc.name === loan.loan_application)!, { status: "Rejected" });
  assert.equal((await service.withdrawCapitalNeed(need.need_id)).status, "WITHDRAWN");
  assert.equal(service.createOffer(asset.receivable_id, { seller_party_id: SEEKER }).status, "LIVE");
});

test("the Lending handover is idempotent on (receivable, invoice), also for parallel requests", async () => {
  const service = new SponsumService();
  const mock = erp(service);
  const asset = await linked(service);
  const { need } = service.createCapitalNeed({ seeker_party_id: SEEKER, kind: "SHORT_DEBT", amount: "5000", tenor_months: 6 });
  await service.withCheckedInvoice(asset.receivable_id, () =>
    service.confirmCapitalNeed(need.need_id, { receivable_id: asset.receivable_id, confirm: true })
  );
  const [first, second] = await Promise.all([
    service.requestCapitalNeedLoan(need.need_id, { confirm: true }),
    service.requestCapitalNeedLoan(need.need_id, { confirm: true })
  ]);
  assert.equal(mock.docs.get("Loan Application")!.length, 1);
  assert.equal([first.created, second.created].filter(Boolean).length, 1);
  assert.equal(first.loan_application, second.loan_application);
  const retry = await service.requestCapitalNeedLoan(need.need_id, { confirm: true });
  assert.equal(retry.created, false);
  assert.equal(mock.docs.get("Loan Application")!.length, 1);
});

test("a legacy second receivable for an invoice already in Lending gets no second loan", async () => {
  const raw = new MemorySponsumStore();
  const service = new SponsumService(raw);
  const mock = erp(service);
  const asset = await linked(service);
  const { need } = service.createCapitalNeed({ seeker_party_id: SEEKER, kind: "SHORT_DEBT", amount: "2000", tenor_months: 6 });
  await service.withCheckedInvoice(asset.receivable_id, () =>
    service.confirmCapitalNeed(need.need_id, { receivable_id: asset.receivable_id, confirm: true })
  );
  await service.requestCapitalNeedLoan(need.need_id, { confirm: true });
  // A duplicate stored before the global check existed (e.g. in another tenant).
  const state = raw.snapshot();
  const copy = { ...structuredClone(state.assets[0]), receivable_id: "SPN-LEGACY-1", origin_tenant_id: "tenant-old" };
  state.assets.push(copy);
  state.locks.push({ receivable_id: copy.receivable_id, state: "UNLOCKED", offer_id: null, trade_id: null, version: 1 });
  raw.replace(state);
  const other = service.createCapitalNeed({ seeker_party_id: SEEKER, kind: "SHORT_DEBT", amount: "2000", tenor_months: 6 }).need;
  await service.withCheckedInvoice(copy.receivable_id, () =>
    service.confirmCapitalNeed(other.need_id, { receivable_id: copy.receivable_id, confirm: true })
  );
  await assert.rejects(service.requestCapitalNeedLoan(other.need_id, { confirm: true }), domainCode("invoice_already_financed"));
  assert.equal(mock.docs.get("Loan Application")!.length, 1);
});

test("settlement: a manual confirmation needs a second person and the bank reference", () => {
  const service = new SponsumService();
  const boss: Principal = { tenantId: "t1", userId: "boss", email: "boss@example.test", admin: true, legacyTenant: "t1" };
  const second: Principal = { ...boss, userId: "second", email: "second@example.test" };
  const asset = inScope(boss, () => unlinked(service), "write");
  inScope(boss, () => {
    service.setKyc(SEEKER, "PASSED");
    service.setKyc("buyer-1", "PASSED");
  }, "write");
  const offer = inScope(boss, () => service.createOffer(asset.receivable_id, { seller_party_id: SEEKER, min_price: "1000" }), "write");
  const bid = inScope(boss, () => service.createBid(offer.offer_id, "buyer-1", "1100"), "write");
  const trade = inScope(boss, () => service.acceptBid(bid.bid_id, SEEKER), "write");
  const { instruction } = inScope(boss, () => service.getTrade(trade.trade_id), "read");
  assert.equal(instruction!.issued_by, "boss");
  const confirm = { confirm: true, bank_reference: "CAMT-2026-10-08-42" };
  assert.throws(() => inScope(boss, () => service.confirmByProvider(instruction!.instruction_id, confirm), "write"), domainCode("four_eyes_required"));
  const result = inScope(second, () => service.confirmByProvider(instruction!.instruction_id, confirm), "write");
  assert.equal(result.transferred, true);
  assert.equal(result.observation?.provider, "manual-bank-statement");
  const confirmed = inScope(second, () => service.events(asset.receivable_id), "read").find((event) => event.event_type === "SETTLEMENT_CONFIRMED");
  assert.equal(confirmed?.payload.confirmed_by, "second");
  assert.equal(confirmed?.payload.bank_reference, "CAMT-2026-10-08-42");
});

test("settlement webhook: unsigned reports never settle, whatever the body says", async () => {
  const { signSettlementReport, verifySettlementReport, settlementWebhookSecret } = await import("./settlement-webhook.js");
  const service = new SponsumService();
  service.setKyc(SEEKER, "PASSED");
  service.setKyc("buyer-1", "PASSED");
  const asset = unlinked(service);
  const offer = service.createOffer(asset.receivable_id, { seller_party_id: SEEKER, min_price: "1000" });
  const trade = service.acceptBid(service.createBid(offer.offer_id, "buyer-1", "1100").bid_id, SEEKER);
  const { instruction } = service.getTrade(trade.trade_id);
  const report = { provider_event_id: "psp-1", payment_reference: instruction!.payment_reference, observed_amount: "1100.00", observed_currency: "CHF" };
  // The service itself refuses anything not verified by the server.
  assert.throws(() => service.applySettlementWebhook({ provider: "psp", ...report }), domainCode("unsigned_webhook"));

  const secret = "s".repeat(40);
  const now = Date.parse("2026-10-08T10:00:00Z");
  const timestamp = String(Math.floor(now / 1000));
  const headers = { "x-sponsum-timestamp": timestamp, "x-sponsum-signature": signSettlementReport(secret, timestamp, "psp", report) };
  assert.throws(() => verifySettlementReport({ headers, provider: "psp", report, secret: null, nowMs: now }), domainCode("settlement_webhook_not_configured"));
  assert.throws(
    () => verifySettlementReport({ headers: { ...headers, "x-sponsum-signature": "sha256=00" }, provider: "psp", report, secret, nowMs: now }),
    domainCode("unsigned_webhook")
  );
  assert.throws(
    () => verifySettlementReport({ headers, provider: "psp", report: { ...report, observed_amount: "1.00" }, secret, nowMs: now }),
    domainCode("unsigned_webhook")
  );
  assert.throws(() => verifySettlementReport({ headers, provider: "psp", report, secret, nowMs: now + 3_600_000 }), domainCode("unsigned_webhook"));
  verifySettlementReport({ headers, provider: "psp", report, secret, nowMs: now });
  assert.equal(service.applySettlementWebhook({ provider: "psp", ...report, signed: true }).transferred, true);
  assert.equal(settlementWebhookSecret({ SPONSUM_SETTLEMENT_WEBHOOK_SECRET_FILE: "/x" }, () => "short"), null);
  assert.equal(settlementWebhookSecret({}, () => secret), null);
});


// SPO-02 (UX-Test 2026-10-09): evidence from the request never counts as proven.

test("a manual receivable ignores evidence claims from the request; only risk flags are taken", async () => {
  const service = new SponsumService(new MemorySponsumStore());
  const asset = await inScope(alice, () =>
    service.submitReceivable({
      ...input("RE-700", "seller-ui"),
      evidence: { ...FULL, debtorAcknowledged: true, hasAcceptance: true, hasPreviousAssignment: true }
    })
  );
  assert.equal(asset.status, "UNVERIFIED");
  const checks = inScope(alice, () => service.dossier(asset.receivable_id)).verification?.checks;
  assert.ok(checks);
  for (const key of ["contract", "delivery_evidence", "debtor_acknowledged", "acceptance", "debtor_kyc", "creditor_kyc", "invoice", "unpaid"]) {
    assert.equal(checks[key as keyof typeof checks], false, key);
  }
  assert.equal(checks.no_previous_assignment, false);
  assert.ok(asset.verification_score < 40);
});

test("a manual receivable needs real issue and maturity dates", async () => {
  const service = new SponsumService(new MemorySponsumStore());
  const base = input("RE-701", "seller-ui");
  await assert.rejects(
    inScope(alice, () => service.submitReceivable({ ...base, issue_date: "", maturity_date: "2026-10-01" })),
    domainCode("validation_error")
  );
  await assert.rejects(
    inScope(alice, () => service.submitReceivable({ ...base, issue_date: "31.02.2026", maturity_date: "2026-10-01" })),
    domainCode("validation_error")
  );
  await assert.rejects(
    inScope(alice, () => service.submitReceivable({ ...base, issue_date: "2026-10-02", maturity_date: "2026-10-01" })),
    domainCode("validation_error")
  );
  const ok = await inScope(alice, () => service.submitReceivable({ ...base, issue_date: "01.09.2026", maturity_date: "30.11.2026" }));
  assert.equal(ok.issue_date, "2026-09-01");
  assert.equal(ok.maturity_date, "2026-11-30");
});

test("verify takes only what a person attests and records who it was", async () => {
  const service = new SponsumService(new MemorySponsumStore());
  const asset = await inScope(alice, () => service.submitReceivable(input("RE-702", "seller-ui")));
  assert.equal(asset.status, "UNVERIFIED");
  // too little attested: stays below the thresholds
  const weak = inScope(alice, () => service.verify(asset.receivable_id, { unpaid: true, hasInvoice: true }));
  assert.equal(weak.status, "UNVERIFIED");
  const strong = inScope(alice, () =>
    service.verify(asset.receivable_id, { ...FULL, debtorAcknowledged: true, hasAcceptance: true })
  );
  assert.equal(strong.status, "ACCEPTED");
  const event = inScope(alice, () => service.dossier(asset.receivable_id))
    .events.filter((row) => row.event_type === "RECEIVABLE_VERIFIED")
    .pop();
  assert.equal((event?.payload as { attested_by?: string } | undefined)?.attested_by, "alice@example.test");
});
