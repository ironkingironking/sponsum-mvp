import assert from "node:assert/strict";
import test from "node:test";
import { DomainError } from "@sponsum/shared";
import { inScope, type Principal } from "./access-context.js";
import type { LendingConfig } from "./lending-bridge.js";
import { createLendingMock } from "./lending-mock.js";
import { MemorySponsumStore } from "./store.js";
import { SponsumService } from "./service.js";

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
  const asset = await linked(service);
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
