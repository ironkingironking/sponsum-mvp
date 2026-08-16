import "./sponsum-test-env.js";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createApp } from "../../app.js";

test("HTTP create-receivable then get-receivable on shipped createApp", async () => {
  const app = createApp();
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no bind");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const created = await fetch(`${base}/api/sponsum/v1/receivables`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoice_id: `INV-HTTP-${Date.now()}`,
        nominal_amount: "12500.5",
        issue_date: "2026-08-01",
        maturity_date: "2026-09-15",
        creditor_party_id: "seller-http",
        debtor_party_id: "debtor-http",
        evidence: { hasInvoice: true, unpaid: true, hasDispute: false, hasContract: true }
      })
    });
    assert.equal(created.status, 200);
    const body = (await created.json()) as { receivable_id: string; status: string; nominal_amount: string };
    assert.ok(body.receivable_id);
    assert.equal(body.nominal_amount, "12500.50");
    assert.ok(body.status);

    const got = await fetch(`${base}/api/sponsum/v1/receivables/${body.receivable_id}`);
    assert.equal(got.status, 200);
    const again = (await got.json()) as { receivable_id: string; nominal_amount: string };
    assert.equal(again.receivable_id, body.receivable_id);
    assert.equal(again.nominal_amount, "12500.50");

    const paid = await fetch(`${base}/api/sponsum/v1/settlement/mark-paid`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    assert.equal(paid.status, 409);
    const paidBody = (await paid.json()) as { error: { code: string } };
    assert.equal(paidBody.error.code, "settlement_requires_provider");

    const desk = await fetch(`${base}/sponsum/`);
    assert.equal(desk.status, 200);
    const html = await desk.text();
    assert.match(html, /Sponsum/);
    assert.match(html, /sponsum-desk.js/);

    const parties = await fetch(`${base}/api/sponsum/v1/parties`);
    assert.equal(parties.status, 200);
    const partyBody = (await parties.json()) as { companies: unknown[]; customers: unknown[]; source: string };
    assert.ok(Array.isArray(partyBody.companies));
    assert.ok(Array.isArray(partyBody.customers));
    assert.ok(partyBody.source === "erpnext" || partyBody.source === "local");

    const wechsel = await fetch(`${base}/api/sponsum/v1/wechsel-drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        drawer_party_id: "seller-http",
        drawee_party_id: "debtor-http",
        amount: "8000",
        issue_date: "2026-08-16",
        maturity_date: "2026-11-16",
        place_of_payment: "Zürich"
      })
    });
    assert.equal(wechsel.status, 200);
    const paper = (await wechsel.json()) as { draft: { instrument_id: string; status: string } };
    const endorse = await fetch(`${base}/api/sponsum/v1/wechsel-drafts/${paper.draft.instrument_id}/endorse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    assert.equal(endorse.status, 403);
    const accepted = await fetch(`${base}/api/sponsum/v1/wechsel-drafts/${paper.draft.instrument_id}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    assert.equal(accepted.status, 200);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test("HTTP dispute and settlement dossiers 404 or resolve from workspace", async () => {
  const app = createApp();
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no bind");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const missing = await fetch(`${base}/api/sponsum/v1/disputes/does-not-exist`);
    assert.equal(missing.status, 404);
    const missingSettle = await fetch(`${base}/api/sponsum/v1/settlements/trd-missing`);
    assert.equal(missingSettle.status, 404);
    const missingZes = await fetch(`${base}/api/sponsum/v1/assignments/zes-missing`);
    assert.equal(missingZes.status, 404);

    const workspace = await fetch(`${base}/api/sponsum/v1/workspace`);
    assert.equal(workspace.status, 200);
    const book = (await workspace.json()) as {
      disputes: Array<{ dispute_id: string; receivable_id: string }>;
      settlements: Array<{ instruction_id: string }>;
    };
    if (book.disputes[0]) {
      const dispute = await fetch(`${base}/api/sponsum/v1/disputes/${encodeURIComponent(book.disputes[0].dispute_id)}`);
      assert.equal(dispute.status, 200);
      const pack = (await dispute.json()) as { asset: { receivable_id: string } };
      assert.equal(pack.asset.receivable_id, book.disputes[0].receivable_id);
    }
    if (book.settlements[0]) {
      const settle = await fetch(`${base}/api/sponsum/v1/settlements/${book.settlements[0].instruction_id}`);
      assert.equal(settle.status, 200);
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
