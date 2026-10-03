import assert from "node:assert/strict";
import test from "node:test";
import { DomainError } from "./receivable-transitions.js";
import {
  assertInstrumentAllowed,
  assertNoAutoBuy,
  assertNoSponsumFunds,
  getPolicy
} from "./receivable-policy.js";

test("CH policy denies Wechsel, auto-buy, and Sponsum-held funds", () => {
  const policy = getPolicy("CH");
  assert.equal(policy.legal_bill_of_exchange, "DENY");
  assert.equal(policy.auto_buy, "DENY");
  assert.equal(policy.sponsum_holds_funds, "DENY");
  assert.equal(policy.fractional_tokens, "DENY");
  assert.throws(() => assertInstrumentAllowed("CH", "LEGAL_BILL_OF_EXCHANGE"), DomainError);
  assert.throws(() => assertNoAutoBuy(true, "CH"), DomainError);
  assert.throws(() => assertNoSponsumFunds(true, "CH"), DomainError);
  assert.doesNotThrow(() => assertNoSponsumFunds(false, "CH"));
});
