import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const desk = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../../public/sponsum/sponsum-desk.js"),
  "utf8"
);

test("settlement list uses in-place expand instead of leaving the index", () => {
  assert.match(desk, /function toggleSettlementRow/);
  assert.match(desk, /settle-toggle/);
  assert.match(desk, /aria-expanded/);
  assert.match(desk, /hash === "#\/settlement"/);
  assert.match(desk, /fillSettlementPanel/);
  assert.doesNotMatch(
    desk,
    /if \(settlement\) return renderSettlementDossier/
  );
});
