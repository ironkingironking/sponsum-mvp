import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { loadFulfilmentCases, lookupFulfilmentBox, monitionFromAcceptance } from "./fulfilment-bridge.js";

test("maps customer monition to Nicht- and Schlechterfüllung", () => {
  assert.equal(monitionFromAcceptance({ decision: "accepted" }).kind, "none");
  assert.equal(
    monitionFromAcceptance({ decision: "rejected", categories: ["incomplete"] }).kind,
    "nichterfuellung"
  );
  assert.equal(
    monitionFromAcceptance({ decision: "accepted_with_defects", categories: ["quality"] }).kind,
    "schlechterfuellung"
  );
  assert.equal(
    monitionFromAcceptance({ decision: "rejected", categories: ["incomplete", "quality"] }).kind,
    "beides"
  );
});

test("lookupFulfilmentBox matches invoice and customer", () => {
  const dir = mkdtempSync(join(tmpdir(), "ff-"));
  const file = join(dir, "fulfilment-cases.json");
  writeFileSync(
    file,
    JSON.stringify({
      cases: {
        "MFC-1": {
          id: "MFC-1",
          status: "disputed",
          disputed: true,
          billing_gate: "blocked",
          customer: "Nordholz AG",
          sales_order_id: "SAL-ORD-1",
          items: [{ item_key: "SO-08", required: true, status: "blocked" }],
          acceptance: {
            decision: "rejected",
            categories: ["incomplete"],
            comment: "Lieferung fehlt vollständig."
          }
        }
      }
    })
  );
  const cases = loadFulfilmentCases(file);
  const hit = lookupFulfilmentBox({ invoiceId: "INV-X", customer: "Nordholz AG" }, cases);
  assert.equal(hit?.id, "MFC-1");
  assert.equal(hit?.monition.kind, "nichterfuellung");
  assert.match(hit?.monition.comment || "", /fehlt/);
  assert.equal(lookupFulfilmentBox({ invoiceId: "NOPE", customer: "Other" }, cases), null);
});
