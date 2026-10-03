import "./sponsum-test-env.js";
import { authorizedFetch as fetch } from "./access-test-env.js";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createApp } from "../../app.js";

// Production state today: no loan product and no technical user, so Lending is not configured (O1/O8).
for (const key of Object.keys(process.env)) if (key.startsWith("MOVENA_LENDING_")) delete process.env[key];

test("HTTP: confirm a capital need as tenant admin, Lending answers not configured, status says so", async () => {
  const server = createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no bind");
  const api = `http://127.0.0.1:${address.port}/api/sponsum/v1`;
  const post = (path: string, body: unknown) =>
    fetch(`${api}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  try {
    const created = await post("/receivables", {
      invoice_id: `ACC-SINV-HTTP-${Date.now()}`,
      nominal_amount: "30000",
      issue_date: "2026-09-01",
      maturity_date: "2026-11-30",
      creditor_party_id: "customer:Nordholz AG",
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
    assert.equal(created.status, 200);
    const asset = (await created.json()) as { receivable_id: string };

    const needResponse = await post("/capital/needs", {
      seeker_party_id: "customer:Nordholz AG",
      kind: "SHORT_DEBT",
      amount: "10000",
      tenor_months: 6
    });
    assert.equal(needResponse.status, 200);
    const { need } = (await needResponse.json()) as { need: { need_id: string } };

    const dossier = (await (await fetch(`${api}/capital/needs/${need.need_id}`)).json()) as {
      can_confirm: boolean;
      lending_candidates: Array<{ receivable_id: string }>;
    };
    assert.equal(dossier.can_confirm, true);
    assert.ok(dossier.lending_candidates.some((row) => row.receivable_id === asset.receivable_id));

    const unconfirmed = await post(`/capital/needs/${need.need_id}/confirm`, { receivable_id: asset.receivable_id });
    assert.equal(unconfirmed.status, 400);

    const confirmed = await post(`/capital/needs/${need.need_id}/confirm`, { receivable_id: asset.receivable_id, confirm: true });
    assert.equal(confirmed.status, 200);
    assert.equal(((await confirmed.json()) as { status: string }).status, "CONFIRMED");

    const loan = await post(`/capital/needs/${need.need_id}/lending`, { confirm: true });
    assert.equal(loan.status, 503);
    assert.equal(((await loan.json()) as { error: { code: string } }).error.code, "lending_not_configured");

    const status = await fetch(`${api}/receivables/${asset.receivable_id}/lending`);
    assert.equal(status.status, 200);
    const statusBody = (await status.json()) as { configured: boolean; lending: unknown };
    assert.equal(statusBody.configured, false);
    assert.equal(statusBody.lending, null);

    const customers = await fetch(`${api}/lending/customers`);
    assert.equal(customers.status, 200);
    const customersBody = (await customers.json()) as { configured: boolean; customers: unknown[] };
    assert.equal(customersBody.configured, false);
    assert.deepEqual(customersBody.customers, []);

    const lombard = await fetch(`${api}/lombard`);
    assert.equal(lombard.status, 200);
    assert.equal(((await lombard.json()) as { configured: boolean }).configured, false);
    const lombardRequest = await post("/lombard", { customer_id: "customer:Nordholz AG", amount: "1000", custody_ref: "", confirm: true });
    assert.equal(lombardRequest.status, 400);
    assert.equal(((await lombardRequest.json()) as { error: { code: string } }).error.code, "custody_reference_invalid");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
