import assert from "node:assert/strict";
import test from "node:test";

import {
  addSwissLegalDays,
  assessJurisdiction,
  computeLegalDeadline,
  inferCanton,
  inferFamily
} from "./jurisdiction-deadlines.js";

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

test("ZPO: delivery in the summer standstill starts on 16.08. (D-01)", () => {
  const zpo = assessJurisdiction(baseCtx, { family: "zpo", from: "2026-07-15" });
  assert.equal(zpo.deadlines.find((row) => row.id === "zpo-antwort")?.due, "2026-09-04");
  assert.equal(zpo.deadlines.find((row) => row.id === "zpo-berufung")?.due, "2026-09-14");
  assert.equal(zpo.deadlines.find((row) => row.id === "zpo-beschwerde")?.due, "2026-09-14");
  const rules = zpo.deadlines.find((row) => row.id === "zpo-antwort")?.rules || [];
  assert.ok(rules.some((rule) => /Stillstand Sommer/.test(rule)));
  assert.ok(rules.some((rule) => /kantonale Feiertage/.test(rule)));
  assert.match(zpo.disclaimer, /Art\. 145 ZPO/);
});

test("ZPO: days inside the standstill are not counted", () => {
  // Zustellung 10.07.2026: 11.–14.07. zählen (4 Tage), dann Stillstand bis 15.08., ab 16.08. die übrigen 6 Tage → 21.08.2026
  assert.equal(computeLegalDeadline("2026-07-10", 10, "zpo")?.due, "2026-08-21");
  // without standstill the old calculation stays available
  assert.equal(addSwissLegalDays("2026-07-10", 10), "2026-07-20");
});

test("ZPO: Easter standstill 2026 (Easter Sunday 05.04.)", () => {
  // Zustellung 25.03.2026: 26.–28.03. zählen (3), Stillstand 29.03.–12.04., ab 13.04. noch 7 Tage → 19.04. (So) → 20.04.2026
  assert.equal(computeLegalDeadline("2026-03-25", 10, "zpo")?.due, "2026-04-20");
});

test("ZPO: Christmas standstill crosses the year", () => {
  // Zustellung 15.12.2026: 16.–17.12. zählen (2), Stillstand 18.12.–02.01., ab 03.01.2027 noch 8 Tage → 10.01.2027 (So) → 11.01.2027
  assert.equal(computeLegalDeadline("2026-12-15", 10, "zpo")?.due, "2027-01-11");
  // delivery on 24.12. starts on 03.01.2027
  assert.equal(computeLegalDeadline("2026-12-24", 10, "zpo")?.counting_from, "2027-01-03");
});

test("ZPO: an end on Saturday right before the standstill moves past the standstill", () => {
  // 2026: Zustellung 07.12., 10 Tage → Do 17.12.; 12 Tage → 8.–17.12. (10), Stillstand, 03.01. (11), 04.01.2027 (12)
  assert.equal(computeLegalDeadline("2026-12-07", 10, "zpo")?.due, "2026-12-17");
  assert.equal(computeLegalDeadline("2026-12-07", 12, "zpo")?.due, "2027-01-04");
  // 2022: Zustellung 07.12., 10 Tage → Sa 17.12.2022; Montag 19.12. liegt im Stillstand → Di 03.01.2023
  assert.equal(computeLegalDeadline("2022-12-07", 10, "zpo")?.due, "2023-01-03");
});

test("summary procedure and StPO ignore the standstill", () => {
  assert.equal(computeLegalDeadline("2026-07-15", 10, "zpo-summary")?.due, "2026-07-27");
  assert.equal(computeLegalDeadline("2026-07-15", 10, "stpo")?.due, "2026-07-27");
  const stpo = assessJurisdiction(baseCtx, { family: "stpo", from: "2026-07-15" });
  assert.equal(stpo.deadlines.find((row) => row.id === "stpo-strafbefehl")?.due, "2026-07-27");
  assert.match(stpo.disclaimer, /keine Gerichtsferien/);
});

test("VwVG/BGG use the same standstill periods", () => {
  const admin = assessJurisdiction(baseCtx, { family: "admin", from: "2026-07-15" });
  assert.equal(admin.deadlines.find((row) => row.id === "vwvg-beschwerde")?.due, "2026-09-14");
});

test("SchKG: Rechtsvorschlag ending in the July holidays runs to the 3rd working day after them", () => {
  // Zustellung 03.07.2026 + 10 Tage = 13.07. (Mo) → nicht betroffen
  assert.equal(computeLegalDeadline("2026-07-03", 10, "schkg")?.due, "2026-07-13");
  // Zustellung 08.07.2026 + 10 Tage = 18.07. (Sa, in den Ferien) → 3. Werktag nach dem 31.07.: Mo 03.08., Di 04.08., Mi 05.08.
  // (01.08. ist Feiertag und Samstag, 02.08. Sonntag)
  assert.equal(computeLegalDeadline("2026-07-08", 10, "schkg")?.due, "2026-08-05");
  const schkg = assessJurisdiction({ ...baseCtx, eschkg_case_id: "ESCHK-1" }, { from: "2026-07-08" });
  const rv = schkg.deadlines.find((row) => row.id === "schkg-rv");
  assert.equal(rv?.due, "2026-08-05");
  assert.ok((rv?.rules || []).some((rule) => /Art\. 63 SchKG/.test(rule)));
});

test("SchKG: delivery during the holidays takes effect on the first day after them", () => {
  // Zustellung 20.07.2026 (Ferien bis 31.07.) wirkt am 01.08.; + 10 Tage = 11.08.2026
  assert.equal(computeLegalDeadline("2026-07-20", 10, "schkg")?.due, "2026-08-11");
});

test("Justitia fiction counts calendar days without moving to a working day", () => {
  assert.equal(computeLegalDeadline("2026-07-15", 7, "fiction")?.due, "2026-07-22");
  // 15.08.2026 + 7 = Sa 22.08.2026 bleibt Samstag
  assert.equal(computeLegalDeadline("2026-08-15", 7, "fiction")?.due, "2026-08-22");
});

test("invalid dates give no deadline", () => {
  assert.equal(computeLegalDeadline("2026-02-31", 10, "zpo"), null);
  assert.equal(computeLegalDeadline("", 10, "zpo"), null);
});
