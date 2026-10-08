import assert from "node:assert/strict";
import test from "node:test";
import { DomainError } from "@sponsum/shared";
import { inScope, type Principal } from "./access-context.js";
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
