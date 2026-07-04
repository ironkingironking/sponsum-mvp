import assert from "node:assert/strict";
import test from "node:test";
import { createClaimSchema, publishClaimSchema } from "./schemas";
import { ClaimStatus, InstrumentType, PartyRole, SettlementModel } from "./types";

const validClaimPayload = {
  title: "Invoice claim",
  instrumentType: InstrumentType.INVOICE_SALE,
  amount: 12000,
  currency: "CHF",
  issueDate: "2026-07-04T00:00:00.000Z",
  maturityDate: "2026-12-31T00:00:00.000Z",
  status: ClaimStatus.DRAFT,
  settlementModel: SettlementModel.SINGLE_MATURITY,
  governingLaw: "Swiss OR",
  jurisdiction: "Zurich",
  transferability: "Transfer allowed with platform checks",
  humanSummary: "Payment claim for delivered services with settlement tracking.",
  parties: [
    { role: PartyRole.ISSUER, displayName: "Issuer" },
    { role: PartyRole.DEBTOR, displayName: "Debtor" }
  ]
};

test("createClaimSchema accepts a valid MVP claim payload", () => {
  const parsed = createClaimSchema.parse(validClaimPayload);

  assert.equal(parsed.title, "Invoice claim");
  assert.equal(parsed.amount, 12000);
  assert.equal(parsed.parties.length, 2);
});

test("createClaimSchema rejects claims without enough parties", () => {
  const result = createClaimSchema.safeParse({
    ...validClaimPayload,
    parties: [{ role: PartyRole.ISSUER, displayName: "Issuer" }]
  });

  assert.equal(result.success, false);
});

test("publishClaimSchema applies safe defaults", () => {
  const parsed = publishClaimSchema.parse({ askPrice: 11500 });

  assert.equal(parsed.listingStatus, "PUBLISHED");
  assert.equal(parsed.isPartialAllowed, false);
  assert.equal(parsed.askPrice, 11500);
});
