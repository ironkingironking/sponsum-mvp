import assert from "node:assert/strict";
import test from "node:test";

import { addSwissLegalDays, assessJurisdiction, inferCanton, inferFamily } from "./jurisdiction-deadlines.js";

const baseCtx = {
  receivable_id: "SPN-1",
  invoice_id: "INV-1",
  status: "DISPUTED",
  currency: "CHF",
  nominal_amount: "50000",
  accepted_amount: "40000",
  disputed_amount: "10000",
  debtor_party_id: "d1",
  origin_creditor_party_id: "c1",
  current_holder_party_id: "h1",
  resolve_case_id: null as string | null,
  debtor: { id: "d1", name: "Nordholz AG", kind: "customer", city: "Winterthur" },
  holder: { id: "h1", name: "Movena GmbH", kind: "company", city: "Zürich" }
};

test("maps Winterthur to ZH and ZPO default venue of the defendant", () => {
  assert.equal(inferCanton(baseCtx.debtor).canton, "ZH");
  const zpo = assessJurisdiction(baseCtx, { family: "zpo", from: "2026-08-17" });
  assert.equal(zpo.family, "zpo");
  assert.equal(zpo.canton, "ZH");
  assert.match(zpo.procedure || "", /Ordentliches Verfahren/);
  assert.ok(zpo.venues.some((row) => /Art\. 9\/10 ZPO/.test(row.basis)));
  assert.ok(zpo.deadlines.some((row) => row.id === "zpo-berufung" && row.days === 30 && row.due));
});

test("uses simplified procedure at or below CHF 30'000", () => {
  const small = assessJurisdiction({ ...baseCtx, disputed_amount: "30000", nominal_amount: "30000" }, { family: "zpo" });
  assert.match(small.procedure || "", /Vereinfachtes Verfahren/);
});

test("StPO einsprache is 10 days and SchKG follows eSchKG", () => {
  const stpo = assessJurisdiction(baseCtx, { family: "stpo", from: "2026-08-17" });
  const einsprache = stpo.deadlines.find((row) => row.id === "stpo-strafbefehl");
  assert.equal(einsprache?.days, 10);
  assert.equal(einsprache?.due, "2026-08-27");
  const inferred = inferFamily({ ...baseCtx, eschkg_case_id: "ESCHK-1" });
  assert.equal(inferred, "schkg");
  const schkg = assessJurisdiction({ ...baseCtx, eschkg_case_id: "ESCHK-1" }, { from: "2026-08-17" });
  assert.ok(schkg.deadlines.some((row) => row.id === "schkg-rv" && row.days === 10));
});

test("admin path cites VwVG 30 days", () => {
  const admin = assessJurisdiction(baseCtx, { family: "admin", from: "2026-08-17" });
  assert.ok(admin.deadlines.some((row) => row.days === 30 && /VwVG/.test(row.basis)));
});

test("legal days skip the weekend", () => {
  // Friday 14.08.2026 + 10 days, start Saturday 15.08 → due Monday 24.08
  assert.equal(addSwissLegalDays("2026-08-14", 10), "2026-08-24");
});

test("legal days roll over Good Friday and Easter Monday 2026", () => {
  assert.equal(addSwissLegalDays("2026-04-02", 1), "2026-04-07");
});

test("reads canton from address PLZ and Winterthur city", () => {
  const fromAddress = inferCanton({
    id: "x",
    name: "Nordholz AG",
    kind: "customer",
    address: "Technoparkstrasse 2, 8400 Winterthur"
  });
  assert.equal(fromAddress.canton, "ZH");
});
