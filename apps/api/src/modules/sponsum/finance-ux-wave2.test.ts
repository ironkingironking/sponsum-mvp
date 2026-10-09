import assert from "node:assert/strict";
import test from "node:test";
import type { DomainError } from "@sponsum/shared";
import { inScope, type Principal } from "./access-context.js";
import { overdueDays, setSponsumToday } from "./clock.js";
import { SponsumService } from "./service.js";

const alice: Principal = { tenantId: "tenant-a", userId: "alice", email: "alice@example.test", admin: true, legacyTenant: "tenant-a" };

function seed(service: SponsumService, maturity = "2026-10-07") {
  service.setKyc("buyer-1", "PASSED");
  return service.createReceivable({
    invoice_id: `INV-${Math.random().toString(16).slice(2)}`,
    nominal_amount: "50000",
    issue_date: "2026-08-01",
    maturity_date: maturity,
    creditor_party_id: "seller-1",
    debtor_party_id: "debtor-1",
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
}

test("SPO-03: overdue days count from the day after maturity, settled receivables are never overdue", () => {
  assert.equal(overdueDays({ maturity_date: "2026-09-28", status: "ACCEPTED" }, "2026-10-09"), 11);
  assert.equal(overdueDays({ maturity_date: "2026-10-09", status: "ACCEPTED" }, "2026-10-09"), 0);
  assert.equal(overdueDays({ maturity_date: "2026-09-28", status: "PAID" }, "2026-10-09"), 0);
  assert.equal(overdueDays({ maturity_date: null, status: "ACCEPTED" }, "2026-10-09"), 0);
});

test("SPO-03: an overdue receivable is neither offered, nor bid on, nor sold", () => {
  setSponsumToday(() => "2026-09-01");
  try {
    const service = new SponsumService();
    const asset = seed(service, "2026-09-15");
    const offer = service.createOffer(asset.receivable_id, { seller_party_id: "seller-1", min_price: "48000" });
    const bid = service.createBid(offer.offer_id, "buyer-1", "48900");

    setSponsumToday(() => "2026-09-20");
    const overdue = (error: DomainError) => error.code === "overdue_blocks_offer" && /seit 5 Tagen überfällig/.test(error.message);
    assert.throws(() => service.acceptBid(bid.bid_id, "seller-1"), overdue);
    assert.throws(() => service.createBid(offer.offer_id, "buyer-1", "49000"), overdue);
    assert.equal(service.dossier(asset.receivable_id).overdue_days, 5);
    assert.equal(service.discoveryLevel0().find((row) => row.offer_id === offer.offer_id)?.overdue_days, 5);

    const other = seed(service, "2026-09-10");
    assert.throws(() => service.createOffer(other.receivable_id, { seller_party_id: "seller-1" }), (error: DomainError) => error.code === "overdue_blocks_offer");
    assert.throws(() => service.requestLiquidity(other.receivable_id, "seller-1"), (error: DomainError) => error.code === "overdue_blocks_offer");
  } finally {
    setSponsumToday(() => "2026-09-01");
  }
});

test("SPO-04: a sale paid without an assignment contract is a purchase, not an assigned receivable", () => {
  setSponsumToday(() => "2026-09-01");
  const service = new SponsumService();
  const asset = seed(service);
  const offer = service.createOffer(asset.receivable_id, { seller_party_id: "seller-1", min_price: "48000" });
  const bid = service.createBid(offer.offer_id, "buyer-1", "48900");
  const trade = service.acceptBid(bid.bid_id, "seller-1");
  const { instruction } = service.getTrade(trade.trade_id);
  service.applySettlementWebhook({
    provider: "external-psp",
    provider_event_id: "evt-spo04",
    payment_reference: instruction!.payment_reference,
    observed_amount: instruction!.amount,
    observed_currency: "CHF",
    signed: true
  });
  const after = service.getReceivable(asset.receivable_id);
  assert.equal(after.status, "TRANSFERRED");
  assert.equal(after.instrument_type, "PURCHASED_RECEIVABLE");
  assert.equal(service.dossier(asset.receivable_id).assignment_contract, false);
});

test("SPO-05: every event names the signed-in person", () => {
  const service = new SponsumService();
  const asset = inScope(alice, () => seed(service));
  const events = inScope(alice, () => service.dossier(asset.receivable_id).events);
  assert.ok(events.length > 0);
  for (const event of events) assert.equal((event.payload as Record<string, unknown>).by, "alice@example.test");
});

test("SPO-13: a legal draft records when and by whom it was drafted", async () => {
  const service = new SponsumService();
  const asset = inScope(alice, () => seed(service));
  inScope(alice, () => service.openDispute(asset.receivable_id, "10000", "resolve-spo13"));
  const drafted = await inScope(alice, () => service.generateDisputeForm(asset.receivable_id, "mahnung", { use_ai: false }));
  assert.equal(drafted.form.created_by, "alice@example.test");
  assert.match(drafted.form.created_at, /^\d{4}-\d{2}-\d{2}T/);
});
