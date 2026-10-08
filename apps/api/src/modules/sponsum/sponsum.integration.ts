import "./sponsum-test-env.js";
import { authorizedFetch as fetch } from "./access-test-env.js";
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
    const signed = await fetch(`${base}/api/sponsum/v1/wechsel-drafts/${paper.draft.instrument_id}/sign`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: "DRAWER", quality: "SES" })
    });
    assert.equal(signed.status, 200);
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
      const pack = (await dispute.json()) as {
        asset: { receivable_id: string };
        workbench: { ooc_stage: string };
        templates: unknown[];
      };
      assert.equal(pack.asset.receivable_id, book.disputes[0].receivable_id);
      assert.ok(pack.workbench.ooc_stage);
      assert.ok(Array.isArray(pack.templates) && pack.templates.length >= 4);
      const denied = await fetch(`${base}/api/sponsum/v1/disputes/${encodeURIComponent(book.disputes[0].receivable_id)}/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: "Kanzlei", confirm: false })
      });
      assert.equal(denied.status, 400);
      const exported = await fetch(`${base}/api/sponsum/v1/disputes/${encodeURIComponent(book.disputes[0].receivable_id)}/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: "Kanzlei", confirm: true })
      });
      assert.equal(exported.status, 200);
      const meta = (await exported.json()) as { export: { id: string }; download: string };
      const zip = await fetch(`${base}${meta.download}`);
      assert.equal(zip.status, 200);
      const bytes = Buffer.from(await zip.arrayBuffer());
      assert.equal(bytes.subarray(0, 2).toString(), "PK");
    }
    if (book.settlements[0]) {
      const settle = await fetch(`${base}/api/sponsum/v1/settlements/${book.settlements[0].instruction_id}`);
      assert.equal(settle.status, 200);
    }

    for (const path of [
      "/capital/needs/kap-missing",
      "/capital/providers/inv-missing",
      "/accounting/acc-missing",
      "/identity/nobody-unknown",
      "/factors/factor-missing"
    ]) {
      const res = await fetch(`${base}/api/sponsum/v1${path}`);
      assert.equal(res.status, 404, path);
    }

    let needId = "";
    const needsRes = await fetch(`${base}/api/sponsum/v1/capital/needs`);
    assert.equal(needsRes.status, 200);
    const needs = (await needsRes.json()) as Array<{ need_id: string }>;
    if (needs[0]) {
      needId = needs[0].need_id;
    } else {
      const created = await fetch(`${base}/api/sponsum/v1/capital/needs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "EQUITY", amount: "250000", purpose: "HTTP dossier", seeker_party_id: "seller-ui" })
      });
      assert.equal(created.status, 200);
      const body = (await created.json()) as { need: { need_id: string } };
      needId = body.need.need_id;
    }
    const need = await fetch(`${base}/api/sponsum/v1/capital/needs/${needId}`);
    assert.equal(need.status, 200);
    const needPack = (await need.json()) as { need: { need_id: string } };
    assert.equal(needPack.need.need_id, needId);

    const providers = await fetch(`${base}/api/sponsum/v1/capital/providers`);
    assert.equal(providers.status, 200);
    const providerRows = (await providers.json()) as Array<{ provider_id: string }>;
    assert.ok(providerRows[0]);
    const provider = await fetch(`${base}/api/sponsum/v1/capital/providers/${providerRows[0].provider_id}`);
    assert.equal(provider.status, 200);
    const providerPack = (await provider.json()) as { provider: { provider_id: string } };
    assert.equal(providerPack.provider.provider_id, providerRows[0].provider_id);

    const ws = (await (await fetch(`${base}/api/sponsum/v1/workspace`)).json()) as {
      accounting: Array<{ proposal_id: string }>;
      kyc: Array<{ party_id: string }>;
      factors: Array<{ node_id: string }>;
    };
    let proposalId = ws.accounting[0]?.proposal_id ?? "";
    if (!proposalId) {
      const json = { "Content-Type": "application/json" };
      await fetch(`${base}/api/sponsum/v1/kyc/seller-dossier`, {
        method: "POST",
        headers: json,
        body: JSON.stringify({ status: "PASSED" })
      });
      await fetch(`${base}/api/sponsum/v1/kyc/buyer-1`, {
        method: "POST",
        headers: json,
        body: JSON.stringify({ status: "PASSED" })
      });
      const recRes = await fetch(`${base}/api/sponsum/v1/receivables`, {
        method: "POST",
        headers: json,
        body: JSON.stringify({
          invoice_id: `INV-ACC-${Date.now()}`,
          nominal_amount: "15000",
          issue_date: "2026-08-01",
          maturity_date: "2026-09-15",
          creditor_party_id: "seller-dossier",
          debtor_party_id: "debtor-dossier",
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
        })
      });
      assert.equal(recRes.status, 200);
      const rec = (await recRes.json()) as { receivable_id: string };
      const offerRes = await fetch(`${base}/api/sponsum/v1/receivables/${rec.receivable_id}/offers`, {
        method: "POST",
        headers: json,
        body: JSON.stringify({ seller_party_id: "seller-dossier", min_price: "14500" })
      });
      assert.equal(offerRes.status, 200);
      const offer = (await offerRes.json()) as { offer_id: string };
      const bidRes = await fetch(`${base}/api/sponsum/v1/offers/${offer.offer_id}/bids`, {
        method: "POST",
        headers: json,
        body: JSON.stringify({ buyer_party_id: "buyer-1", amount: "14600" })
      });
      assert.equal(bidRes.status, 200);
      const bid = (await bidRes.json()) as { bid_id: string };
      const tradeRes = await fetch(`${base}/api/sponsum/v1/bids/${bid.bid_id}/accept`, {
        method: "POST",
        headers: json,
        body: JSON.stringify({ seller_party_id: "seller-dossier" })
      });
      assert.equal(tradeRes.status, 200);
      const trade = (await tradeRes.json()) as { trade_id: string };
      const settlePack = (await (await fetch(`${base}/api/sponsum/v1/trades/${trade.trade_id}`)).json()) as {
        instruction: { instruction_id: string };
      };
      const confirmUrl = `${base}/api/sponsum/v1/settlements/${settlePack.instruction.instruction_id}/provider-confirm`;
      const confirmBody = JSON.stringify({ confirm: true, bank_reference: "CAMT-HTTP-0001", signed: true, provider: "external-psp" });
      // DK-31: the person who accepted the bid cannot confirm the payment; body flags like "signed" change nothing.
      const own = await fetch(confirmUrl, { method: "POST", headers: json, body: confirmBody });
      assert.equal(own.status, 403);
      assert.equal(((await own.json()) as { error: { code: string } }).error.code, "four_eyes_required");
      const confirm = await fetch(
        confirmUrl,
        { method: "POST", headers: json, body: confirmBody },
        { subject: "http-test-admin-2", email: "http-admin-2@example.test" }
      );
      assert.equal(confirm.status, 200);
      const accList = (await (await fetch(`${base}/api/sponsum/v1/accounting`)).json()) as Array<{
        proposal_id: string;
      }>;
      proposalId = accList[0]?.proposal_id ?? "";
    }
    assert.ok(proposalId);
    const acc = await fetch(`${base}/api/sponsum/v1/accounting/${proposalId}`);
    assert.equal(acc.status, 200);
    const accPack = (await acc.json()) as { proposal: { proposal_id: string } };
    assert.equal(accPack.proposal.proposal_id, proposalId);

    assert.ok(ws.kyc[0]);
    const ident = await fetch(`${base}/api/sponsum/v1/identity/${encodeURIComponent(ws.kyc[0].party_id)}`);
    assert.equal(ident.status, 200);
    const identPack = (await ident.json()) as { party_id: string };
    assert.equal(identPack.party_id, ws.kyc[0].party_id);

    assert.ok(ws.factors[0]);
    const factor = await fetch(`${base}/api/sponsum/v1/factors/${ws.factors[0].node_id}`);
    assert.equal(factor.status, 200);
    const factorPack = (await factor.json()) as { node: { node_id: string } };
    assert.equal(factorPack.node.node_id, ws.factors[0].node_id);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
