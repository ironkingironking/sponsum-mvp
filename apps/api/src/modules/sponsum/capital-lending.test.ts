import assert from "node:assert/strict";
import test from "node:test";
import { DomainError } from "@sponsum/shared";
import { inScope, type Principal } from "./access-context.js";
import type { LendingConfig } from "./lending-bridge.js";
import { createLendingMock } from "./lending-mock.js";
import { SponsumService } from "./service.js";

const SEEKER = "customer:Nordholz AG";
const config: LendingConfig = {
  baseUrl: "https://erp.example.invalid",
  site: null,
  apiKey: "<API_KEY>",
  apiSecret: "<API_SECRET>",
  company: "Movena Test AG",
  loanProduct: "Forderungsfinanzierung Test"
};
const admin: Principal = { tenantId: "t1", userId: "admin-1", email: "admin@example.invalid", admin: true, legacyTenant: "t1" };
const member: Principal = { tenantId: "t1", userId: "member-1", email: "member@example.invalid", admin: false, legacyTenant: "t1" };

function seed(service: SponsumService, creditor = SEEKER) {
  const asset = service.createReceivable({
    invoice_id: `ACC-SINV-${Math.random().toString(16).slice(2, 8)}`,
    nominal_amount: "50000",
    issue_date: "2026-09-01",
    maturity_date: "2026-11-30",
    creditor_party_id: creditor,
    debtor_party_id: "customer:Debitor AG",
    evidence: {
      hasInvoice: true,
      invoiceElectronic: true,
      hasContract: true,
      hasDelivery: true,
      unpaid: true,
      hasDispute: false,
      creditorKyc: true,
      debtorKyc: true
    }
  });
  const { need } = service.createCapitalNeed({ seeker_party_id: SEEKER, kind: "SHORT_DEBT", amount: "20000", tenor_months: 6 });
  return { asset, need };
}

function withMock(service: SponsumService) {
  const mock = createLendingMock();
  mock.addCustomer("Nordholz AG");
  service.setLendingDeps(() => ({ config, transport: mock, today: "2026-10-03" }));
  return mock;
}

function domainCode(code: string) {
  return (error: unknown) => {
    assert.ok(error instanceof DomainError, `expected DomainError, got ${error}`);
    assert.equal(error.code, code);
    return true;
  };
}

test("only tenant admins confirm a capital need, explicitly, and it links one receivable", () => {
  const service = new SponsumService();
  const { asset, need } = seed(service);

  assert.throws(
    () => inScope(member, () => service.confirmCapitalNeed(need.need_id, { receivable_id: asset.receivable_id, confirm: true })),
    domainCode("forbidden")
  );
  assert.throws(() => service.confirmCapitalNeed(need.need_id, { receivable_id: asset.receivable_id }), domainCode("validation_error"));

  const confirmed = service.confirmCapitalNeed(need.need_id, { receivable_id: asset.receivable_id, confirm: true });
  assert.equal(confirmed.status, "CONFIRMED");
  assert.equal(confirmed.receivable_id, asset.receivable_id);
  assert.ok(confirmed.confirmed_at);

  // Idempotent for the same receivable, refused for another one.
  assert.equal(service.confirmCapitalNeed(need.need_id, { receivable_id: asset.receivable_id, confirm: true }).status, "CONFIRMED");
  const other = seed(service).asset;
  assert.throws(
    () => service.confirmCapitalNeed(need.need_id, { receivable_id: other.receivable_id, confirm: true }),
    domainCode("already_confirmed")
  );

  const dossier = service.capitalNeedDossier(need.need_id);
  assert.equal(dossier.events.filter((event) => event.event_type === "CAPITAL_NEED_CONFIRMED").length, 1);
  assert.equal(dossier.receivable?.receivable_id, asset.receivable_id);
});

test("confirmation applies the Lending eligibility rules (no equity, not someone else's receivable)", () => {
  const service = new SponsumService();
  const { need } = seed(service);
  const foreign = seed(service, "customer:Andere AG").asset;
  assert.throws(
    () => service.confirmCapitalNeed(need.need_id, { receivable_id: foreign.receivable_id, confirm: true }),
    domainCode("receivable_not_held_by_borrower")
  );
  const { need: equity } = service.createCapitalNeed({ seeker_party_id: SEEKER, kind: "EQUITY", amount: "20000" });
  const own = seed(service).asset;
  assert.throws(
    () => service.confirmCapitalNeed(equity.need_id, { receivable_id: own.receivable_id, confirm: true }),
    domainCode("capital_need_not_debt")
  );
  assert.throws(() => service.confirmCapitalNeed(need.need_id, { receivable_id: "SPN-missing", confirm: true }), domainCode("not_found"));
});

test("dossier offers the seeker's own receivables as candidates and tells who may confirm", () => {
  const service = new SponsumService();
  const { asset, need } = seed(service);
  seed(service, "customer:Andere AG");
  const dossier = service.capitalNeedDossier(need.need_id);
  assert.equal(dossier.can_confirm, true);
  assert.ok(dossier.lending_candidates.some((row) => row.receivable_id === asset.receivable_id));
  assert.ok(dossier.lending_candidates.every((row) => row.receivable_id !== undefined));
  // Records are isolated per user: the member sees only their own need, and may not confirm it.
  const own = inScope(member, () => service.createCapitalNeed({ seeker_party_id: SEEKER, kind: "SHORT_DEBT", amount: "1000" }).need, "write");
  assert.equal(inScope(member, () => service.capitalNeedDossier(own.need_id)).can_confirm, false);
});

test("loan request: not configured until O1/O8, then one draft application via Lending, event once", async () => {
  const service = new SponsumService();
  const { asset, need } = seed(service);
  service.confirmCapitalNeed(need.need_id, { receivable_id: asset.receivable_id, confirm: true });

  service.setLendingDeps(() => ({ config: null, transport: null }));
  await assert.rejects(service.requestCapitalNeedLoan(need.need_id, { confirm: true }), domainCode("lending_not_configured"));
  assert.deepEqual((await service.receivableLending(asset.receivable_id)).configured, false);

  const mock = withMock(service);
  await assert.rejects(service.requestCapitalNeedLoan(need.need_id), domainCode("confirmation_required"));
  await assert.rejects(
    inScope(member, () => service.requestCapitalNeedLoan(need.need_id, { confirm: true })),
    domainCode("forbidden")
  );

  const first = await service.requestCapitalNeedLoan(need.need_id, { confirm: true });
  assert.equal(first.created, true);
  const second = await service.requestCapitalNeedLoan(need.need_id, { confirm: true });
  assert.equal(second.created, false);
  assert.equal(second.loan_application, first.loan_application);

  const [application] = mock.docs.get("Loan Application")!;
  assert.equal(application.movena_sponsum_receivable_id, asset.receivable_id);
  assert.equal(application.movena_sponsum_capital_need_id, need.need_id);
  assert.equal(application.applicant, "Nordholz AG");
  assert.equal(application.loan_amount, "20000.00");

  const events = service.capitalNeedDossier(need.need_id).events.filter((event) => event.event_type === "LENDING_APPLICATION_REQUESTED");
  assert.equal(events.length, 1);

  const pending = await service.receivableLending(asset.receivable_id);
  assert.equal(pending.configured, true);
  assert.equal(pending.lending?.stage, "APPLICATION");

  const loan = mock.approveAndCreateLoan(first.loan_application, [{ payment_date: "2026-10-31", total_payment: 3400 }]);
  const active = await service.receivableLending(asset.receivable_id);
  assert.equal(active.lending?.stage, "LOAN");
  assert.equal(active.lending?.loan?.name, loan);
  assert.deepEqual(active.lending?.next_installment, { payment_date: "2026-10-31", total_payment: 3400 });
});

test("a need without a linked receivable cannot request a loan", async () => {
  const service = new SponsumService();
  const { need } = seed(service);
  withMock(service);
  await assert.rejects(service.requestCapitalNeedLoan(need.need_id, { confirm: true }), domainCode("capital_need_receivable_mismatch"));
});
