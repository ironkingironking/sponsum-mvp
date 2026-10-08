import assert from "node:assert/strict";
import test from "node:test";
import { DomainError, getPolicy } from "@sponsum/shared";
import { SponsumService } from "./service.js";

function seed(service: SponsumService) {
  service.setKyc("buyer-1", "PASSED");
  return service.createReceivable({
    invoice_id: `INV-${Math.random().toString(16).slice(2)}`,
    nominal_amount: "50000",
    issue_date: "2026-08-01",
    maturity_date: "2026-10-07",
    creditor_party_id: "seller-1",
    debtor_party_id: "debtor-1",
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
}

test("create→verify produces a first-class receivable with decimal amounts", () => {
  const service = new SponsumService();
  const asset = seed(service);
  assert.match(asset.receivable_id, /^SPN-CH-20/);
  assert.equal(asset.nominal_amount, "50000.00");
  assert.equal(asset.status, "ACCEPTED");
  assert.ok(asset.verification_score >= 50);
  assert.notEqual(asset.instrument_type, "LEGAL_BILL_OF_EXCHANGE");
  const loaded = service.getReceivable(asset.receivable_id);
  assert.equal(loaded.invoice_id, asset.invoice_id);
});

test("second offer on same invoice is locked", () => {
  const service = new SponsumService();
  const asset = seed(service);
  service.createOffer(asset.receivable_id, { seller_party_id: "seller-1", min_price: "48500" });
  assert.throws(
    () => service.createOffer(asset.receivable_id, { seller_party_id: "seller-1", min_price: "48000" }),
    (error: DomainError) => error.code === "asset_locked"
  );
});

test("disputed receivable cannot be offered clean", () => {
  const service = new SponsumService();
  const asset = seed(service);
  service.openDispute(asset.receivable_id, "10000", "resolve-1");
  assert.throws(
    () => service.createOffer(asset.receivable_id, { seller_party_id: "seller-1", min_price: "40000" }),
    (error: DomainError) => error.code === "dispute_blocks_offer"
  );
  assert.equal(service.getReceivable(asset.receivable_id).resolve_case_id, "resolve-1");
});

test("bid accept creates trade + settlement instruction; transfer only after webhook", () => {
  const service = new SponsumService();
  const asset = seed(service);
  const offer = service.createOffer(asset.receivable_id, { seller_party_id: "seller-1", min_price: "48000" });
  const bid = service.createBid(offer.offer_id, "buyer-1", "48900");
  const trade = service.acceptBid(bid.bid_id, "seller-1");
  assert.equal(trade.status, "SETTLEMENT_PENDING");
  assert.equal(service.getReceivable(asset.receivable_id).status, "TRADE_LOCKED");
  const { instruction } = service.getTrade(trade.trade_id);
  assert.ok(instruction);
  assert.equal(instruction!.payee_party_id, "seller-1");
  assert.equal(instruction!.payer_party_id, "buyer-1");
  assert.match(instruction!.payee_iban, /^CH/);
  assert.ok(instruction!.payment_reference.startsWith("SPN-"));
  assert.equal(service.getReceivable(asset.receivable_id).current_holder_party_id, "seller-1");

  const first = service.applySettlementWebhook({
    provider: "external-psp",
    provider_event_id: "evt-1",
    payment_reference: instruction!.payment_reference,
    observed_amount: instruction!.amount,
    observed_currency: "CHF",
    signed: true
  });
  assert.equal(first.transferred, true);
  assert.equal(service.getReceivable(asset.receivable_id).status, "TRANSFERRED");
  assert.equal(service.getReceivable(asset.receivable_id).current_holder_party_id, "buyer-1");

  const replay = service.applySettlementWebhook({
    provider: "external-psp",
    provider_event_id: "evt-1",
    payment_reference: instruction!.payment_reference,
    observed_amount: instruction!.amount,
    observed_currency: "CHF",
    signed: true
  });
  assert.equal(replay.observation.observation_id, first.observation.observation_id);
  const proposals = service.accounting(asset.receivable_id);
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].lines.length, 3);
});

test("UI paid click cannot confirm settlement", () => {
  const service = new SponsumService();
  assert.throws(() => service.markPaidFromUi(), (error: DomainError) => error.code === "settlement_requires_provider");
});

test("listParties falls back to local asset debtors when ERP is unreachable", async () => {
  const previous = process.env.MOVENA_ERPNEXT_URL;
  process.env.MOVENA_ERPNEXT_URL = "http://127.0.0.1:9";
  try {
    const service = new SponsumService();
    seed(service);
    const parties = await service.listParties();
    assert.ok(parties.customers.some((row) => row.id === "debtor-1"));
    assert.equal(parties.source, "local");
  } finally {
    if (previous === undefined) delete process.env.MOVENA_ERPNEXT_URL;
    else process.env.MOVENA_ERPNEXT_URL = previous;
  }
});

test("Zession creates assignment package; Wechsel draft is not a legal bill", () => {
  const service = new SponsumService();
  const asset = seed(service);
  const { assignment, trade, instruction } = service.createAssignment({
    receivable_id: asset.receivable_id,
    seller_party_id: "seller-1",
    buyer_party_id: "buyer-1",
    purchase_price: "48750",
    factoring_mode: "WITHOUT_RECOURSE",
    notice_mode: "OPEN"
  });
  assert.equal(assignment.contract_title, "Forderungskauf- und Zessionsvertrag");
  assert.match(assignment.legal_basis, /Zession/);
  assert.equal(trade.status, "SETTLEMENT_PENDING");
  assert.ok(instruction);
  assert.equal(service.getReceivable(asset.receivable_id).status, "TRADE_LOCKED");

  const { draft, asset: paper } = service.createWechselDraft({
    drawer_party_id: "seller-1",
    drawee_party_id: "debtor-1",
    amount: "12000",
    issue_date: "2026-08-16",
    maturity_date: "2026-11-16",
    place_of_payment: "Bern"
  });
  assert.equal(draft.legal_qualification, "NOT_A_BILL_OF_EXCHANGE");
  assert.equal(draft.instrument_type, "ELECTRONIC_TRADE_INSTRUMENT");
  assert.equal(draft.wechsel_form, "GEZOGEN");
  assert.equal(draft.wechsel_purpose, "HANDELSWECHSEL");
  assert.equal(draft.verfall_art, "TAGWECHSEL");
  assert.equal(paper.instrument_type, "ELECTRONIC_TRADE_INSTRUMENT");
  assert.notEqual(paper.instrument_type, "LEGAL_BILL_OF_EXCHANGE");

  const sola = service.createWechselDraft({
    drawer_party_id: "seller-1",
    drawee_party_id: "ignored-debtor",
    amount: "4000",
    issue_date: "2026-08-16",
    maturity_date: "2026-09-16",
    wechsel_form: "SOLA",
    verfall_art: "NACHSICHTWECHSEL",
    after_sight_days: 15
  }).draft;
  assert.equal(sola.wechsel_form, "SOLA");
  assert.equal(sola.drawee_party_id, "seller-1");
  assert.equal(sola.wechsel_purpose, "HANDELSWECHSEL");
  assert.equal(sola.verfall_art, "NACHSICHTWECHSEL");
  assert.equal(sola.after_sight_days, 15);
  assert.throws(
    () =>
      service.createWechselDraft({
        drawer_party_id: "seller-1",
        drawee_party_id: "debtor-1",
        amount: "1",
        issue_date: "2026-08-16",
        maturity_date: "2026-09-16",
        wechsel_purpose: "FINANZWECHSEL"
      }),
    (error: DomainError) => error.code === "policy_denied"
  );
});

test("Wechsel dossier exposes Akzept, Sicherheit and Zession; Aval and Indossament stay denied", async () => {
  const service = new SponsumService();
  service.setKyc("seller-1", "PASSED");
  const { draft } = service.createWechselDraft({
    drawer_party_id: "seller-1",
    drawee_party_id: "debtor-1",
    amount: "12000",
    issue_date: "2026-08-16",
    maturity_date: "2026-11-16",
    place_of_payment: "Bern"
  });
  assert.equal(draft.status, "DRAFT");
  await assert.rejects(
    () => service.acknowledgeWechsel(draft.instrument_id),
    (error: DomainError) => error.code === "unsigned"
  );
  const issued = (await service.signWechsel(draft.instrument_id, { role: "DRAWER" })).draft;
  assert.equal(issued.status, "ISSUED");
  assert.equal(issued.signatures[0].quality, "SES");
  await assert.rejects(
    () => service.signWechsel(draft.instrument_id, { role: "DRAWEE", quality: "QES" }),
    (error: DomainError) => error.code === "skribble_signer_required"
  );
  const accepted = await service.acknowledgeWechsel(draft.instrument_id);
  assert.equal(accepted.status, "ACKNOWLEDGED");
  assert.equal(accepted.acceptance?.legal_qualification, "COMMERCIAL_ACKNOWLEDGEMENT");

  assert.throws(
    () => service.addWechselGuarantee(draft.instrument_id, { guarantor_party_id: "bank-1", kind: "WECHSELAVAL" }),
    (error: DomainError) => error.code === "policy_denied"
  );
  const secured = service.addWechselGuarantee(draft.instrument_id, {
    guarantor_party_id: "bank-1",
    kind: "SURETY",
    amount: "12000"
  });
  assert.equal(secured.status, "SECURED");
  assert.equal(secured.guarantees[0].legal_qualification, "NOT_A_WECHSELAVAL");

  assert.throws(() => service.endorseWechsel(draft.instrument_id), (error: DomainError) => error.code === "policy_denied");
  assert.throws(() => service.protestWechsel(draft.instrument_id), (error: DomainError) => error.code === "policy_denied");

  const dossier = service.wechselDossier(draft.instrument_id);
  assert.equal(dossier.functions.zession.decision, "ALLOW");
  assert.equal(dossier.functions.aval.decision, "DENY");
  assert.equal(dossier.functions.indossament.decision, "DENY");

  const assigned = service.assignWechsel(draft.instrument_id, {
    buyer_party_id: "buyer-1",
    purchase_price: "11800"
  });
  assert.equal(assigned.draft.status, "ASSIGNED");
  assert.equal(assigned.assignment.legal_basis.includes("Zession"), true);
  const zedent = await service.signAssignment(assigned.assignment.assignment_id, { role: "TRANSFEROR" });
  const zessionar = await service.signAssignment(assigned.assignment.assignment_id, { role: "TRANSFEREE" });
  assert.equal(zedent.signature.quality, "SES");
  assert.equal(zessionar.assignment.signatures.length, 2);
  const { anchor } = service.anchorWechsel(draft.instrument_id);
  assert.equal(anchor.method, "PROTOCOL_CHAIN");
  assert.match(anchor.legal_note, /kein/i);
});

test("QES via Skribble mock completes after sync; DEMO is not claimed as QES", async () => {
  process.env.SKRIBBLE_MOCK = "1";
  delete process.env.SKRIBBLE_MOCK_COMPLETE;
  const service = new SponsumService();
  const { draft } = service.createWechselDraft({
    drawer_party_id: "seller-1",
    drawee_party_id: "debtor-1",
    amount: "3000",
    issue_date: "2026-08-16",
    maturity_date: "2026-11-16"
  });
  const started = await service.signWechsel(draft.instrument_id, {
    role: "DRAWER",
    quality: "QES",
    signer_email: "aussteller@movena.ch"
  });
  assert.equal(started.signature.status, "PENDING");
  assert.equal(started.signature.quality, "QES");
  assert.ok(started.signature.signing_url);
  assert.equal(started.draft.status, "DRAFT");
  process.env.SKRIBBLE_MOCK_COMPLETE = "1";
  const synced = await service.syncSignatures(draft.instrument_id);
  assert.equal(synced.status, "ISSUED");
  assert.equal(synced.signatures[0].status, "SIGNED");
  assert.equal(synced.signatures[0].quality, "QES");
  delete process.env.SKRIBBLE_MOCK_COMPLETE;
  delete process.env.SKRIBBLE_MOCK;
});

test("capital search matches investors and lenders without a Wechsel", () => {
  const service = new SponsumService();
  const equity = service.createCapitalNeed({
    kind: "EQUITY",
    amount: "250000",
    purpose: "Wachstum"
  });
  assert.equal(equity.need.receivable_id, null);
  assert.equal(equity.need.kind, "EQUITY");
  assert.ok(equity.matches.some((row) => row.offers.includes("EQUITY")));
  assert.ok(equity.need.legal_note.includes("Kein öffentliches Angebot"));

  const short = service.createCapitalNeed({
    kind: "SHORT_DEBT",
    amount: "80000",
    tenor_months: 6
  });
  assert.ok(short.matches.some((row) => row.provider_id === "lend-short"));
  const intro = service.requestCapitalIntro(short.need.need_id, "lend-short");
  assert.equal(intro.interest.status, "INTRODUCED");
  assert.equal(intro.need.status, "INTRODUCED");

  assert.throws(
    () => service.createCapitalNeed({ kind: "SHORT_DEBT", amount: "80000", tenor_months: 24 }),
    (error: DomainError) => error.code === "invalid_capital"
  );
});

test("provider confirm transfers after instruction is issued", () => {
  const service = new SponsumService();
  const asset = seed(service);
  const offer = service.createOffer(asset.receivable_id, { seller_party_id: "seller-1", min_price: "48000" });
  const bid = service.createBid(offer.offer_id, "buyer-1", "48900");
  const trade = service.acceptBid(bid.bid_id, "seller-1");
  const { instruction } = service.getTrade(trade.trade_id);
  assert.ok(instruction);
  assert.throws(() => service.confirmByProvider(instruction!.instruction_id), (error: DomainError) => error.code === "confirmation_required");
  assert.throws(
    () => service.confirmByProvider(instruction!.instruction_id, { confirm: true }),
    (error: DomainError) => error.code === "bank_reference_required"
  );
  const confirmed = service.confirmByProvider(instruction!.instruction_id, { confirm: true, bank_reference: "CAMT-2026-10-08-0001" });
  assert.equal(confirmed.transferred, true);
  assert.equal(service.getReceivable(asset.receivable_id).status, "TRANSFERRED");
  assert.throws(() => service.markPaidFromUi(), (error: DomainError) => error.code === "settlement_requires_provider");
});

test("mismatch webhook does not transfer", () => {
  const service = new SponsumService();
  const asset = seed(service);
  const offer = service.createOffer(asset.receivable_id, { seller_party_id: "seller-1", min_price: "48000" });
  const bid = service.createBid(offer.offer_id, "buyer-1", "48900");
  const trade = service.acceptBid(bid.bid_id, "seller-1");
  const { instruction } = service.getTrade(trade.trade_id);
  const result = service.applySettlementWebhook({
    provider: "external-psp",
    provider_event_id: "evt-mismatch",
    payment_reference: instruction!.payment_reference,
    observed_amount: "10.00",
    observed_currency: "CHF",
    signed: true
  });
  assert.equal(result.transferred, false);
  assert.equal(service.getReceivable(asset.receivable_id).status, "TRADE_LOCKED");
});

test("policy denies Wechsel, auto-buy, and funds holding", () => {
  const policy = getPolicy("CH");
  assert.equal(policy.legal_bill_of_exchange, "DENY");
  assert.equal(policy.auto_buy, "DENY");
  assert.equal(policy.sponsum_holds_funds, "DENY");
  assert.equal(policy.fractional_tokens, "DENY");
  assert.equal(policy.aval_as_wechselaval, "DENY");
  const service = new SponsumService();
  assert.throws(
    () =>
      service.createReceivable({
        invoice_id: "INV-WECHSEL",
        nominal_amount: "1000",
        issue_date: "2026-08-01",
        maturity_date: "2026-09-01",
        creditor_party_id: "seller-1",
        debtor_party_id: "debtor-1",
        instrument_type: "LEGAL_BILL_OF_EXCHANGE"
      }),
    (error: DomainError) => error.code === "policy_denied"
  );
  const asset = seed(service);
  assert.throws(
    () => service.createOffer(asset.receivable_id, { seller_party_id: "seller-1", auto_buy: true }),
    (error: DomainError) => error.code === "policy_denied"
  );
  assert.equal(service.wrapBitcredit(asset.receivable_id, false).ok, false);
  assert.equal(service.wrapRegisterRight(asset.receivable_id, false).ok, false);
});

test("KYC gates offer and bid; protocol events are hash-chained and signed", () => {
  const service = new SponsumService();
  const asset = seed(service);
  service.setKyc("stranger", "NONE");
  assert.throws(
    () => service.createOffer(asset.receivable_id, { seller_party_id: "stranger", min_price: "1" }),
    (error: DomainError) => error.code === "kyc_required"
  );
  const events = service.events(asset.receivable_id);
  assert.ok(events.length >= 2);
  assert.equal(events[1].prev_event_hash, events[0].event_hash);
  assert.ok(events[0].signature);
});

test("VERIFIED receivable cannot get a LIVE offer", () => {
  const service = new SponsumService();
  const asset = service.createReceivable({
    invoice_id: `INV-VERIFIED-${Math.random().toString(16).slice(2)}`,
    nominal_amount: "12500.5",
    issue_date: "2026-08-01",
    maturity_date: "2026-09-15",
    creditor_party_id: "seller-verified",
    debtor_party_id: "debtor-verified",
    evidence: { hasInvoice: true, unpaid: true, hasDispute: false }
  });
  assert.equal(asset.status, "VERIFIED");
  assert.ok(asset.verification_score >= 40 && asset.verification_score < 50);
  assert.throws(
    () => service.createOffer(asset.receivable_id, { seller_party_id: "seller-verified", min_price: "12000" }),
    (error: DomainError) => error.code === "not_accepted"
  );
  const after = service.getReceivable(asset.receivable_id);
  assert.equal(after.status, "VERIFIED");
  assert.equal(service.discoveryLevel0().length, 0);
});

test("non-holder cannot createOffer on another party's receivable", () => {
  const service = new SponsumService();
  const asset = seed(service);
  service.setKyc("other-party", "PASSED");
  assert.throws(
    () => service.createOffer(asset.receivable_id, { seller_party_id: "other-party", min_price: "48000" }),
    (error: DomainError) => error.code === "forbidden"
  );
  assert.equal(service.getReceivable(asset.receivable_id).status, "ACCEPTED");
  assert.equal(service.discoveryLevel0().length, 0);
});

test("dispute, settlement and assignment dossiers are addressable", () => {
  const service = new SponsumService();
  const asset = seed(service);
  service.openDispute(asset.receivable_id, "10000", "resolve-case-alpha");
  const byCase = service.disputeDossier("resolve-case-alpha");
  assert.equal(byCase.dispute.receivable_id, asset.receivable_id);
  assert.equal(byCase.asset.invoice_id, asset.invoice_id);
  assert.equal(byCase.workbench.ooc_stage, "resolve");
  assert.ok(byCase.justitia.compose_url.includes(asset.receivable_id));
  assert.equal(service.disputeDossier(asset.receivable_id).dispute.dispute_id, "resolve-case-alpha");
  assert.throws(() => service.disputeDossier("missing-case"), (error: DomainError) => error.code === "not_found");

  const clean = seed(service);
  const assignment = service.createAssignment({
    receivable_id: clean.receivable_id,
    seller_party_id: "seller-1",
    buyer_party_id: "buyer-1",
    purchase_price: "48500",
    factoring_mode: "TRUE_SALE",
    notice_mode: "OPEN",
    payee_iban: "CH9300762011623852957"
  });
  const zes = service.assignmentDossier(assignment.assignment.assignment_id);
  assert.equal(zes.assignment.receivable_id, clean.receivable_id);
  assert.equal(zes.trade?.trade_id, assignment.trade.trade_id);
  assert.ok(zes.instruction);
  const settle = service.settlementDossier(assignment.trade.trade_id);
  assert.equal(settle.trade.receivable_id, clean.receivable_id);
  assert.equal(settle.assignment?.assignment_id, assignment.assignment.assignment_id);
  assert.equal(service.settlementDossier(settle.instruction!.instruction_id).trade.trade_id, assignment.trade.trade_id);
  assert.throws(() => service.settlementDossier("trd-missing"), (error: DomainError) => error.code === "not_found");
  assert.throws(() => service.assignmentDossier("zes-missing"), (error: DomainError) => error.code === "not_found");
});

test("capital, accounting, identity and factor dossiers are addressable", () => {
  const service = new SponsumService();
  const book = service.workspace();

  const created = service.createCapitalNeed({
    seeker_party_id: "seller-ui",
    kind: "EQUITY",
    amount: "250000",
    purpose: "Wachstum"
  });
  const needPack = service.capitalNeedDossier(created.need.need_id);
  assert.equal(needPack.need.need_id, created.need.need_id);
  assert.equal(needPack.need.purpose, "Wachstum");
  assert.ok(needPack.matches.length >= 1);
  assert.throws(() => service.capitalNeedDossier("kap-missing"), (error: DomainError) => error.code === "not_found");

  const provider = service.listCapitalProviders()[0];
  assert.ok(provider);
  const providerPack = service.capitalProviderDossier(provider.provider_id);
  assert.equal(providerPack.provider.provider_id, provider.provider_id);
  assert.equal(providerPack.provider.display_name, provider.display_name);
  assert.throws(
    () => service.capitalProviderDossier("inv-missing"),
    (error: DomainError) => error.code === "not_found"
  );

  assert.ok(book.accounting.length >= 1);
  const proposal = book.accounting[0];
  const acc = service.accountingDossier(proposal.proposal_id);
  assert.equal(acc.proposal.proposal_id, proposal.proposal_id);
  assert.equal(acc.proposal.receivable_id, proposal.receivable_id);
  assert.ok(acc.asset);
  assert.equal(acc.asset!.receivable_id, proposal.receivable_id);
  assert.throws(() => service.accountingDossier("acc-missing"), (error: DomainError) => error.code === "not_found");

  const party = service.identityDossier("buyer-1");
  assert.equal(party.party_id, "buyer-1");
  assert.equal(party.kyc?.status, "PASSED");
  assert.ok(party.profile);
  assert.throws(() => service.identityDossier("nobody-unknown"), (error: DomainError) => error.code === "not_found");

  const factor = service.factors()[0];
  assert.ok(factor);
  const factorPack = service.factorDossier(factor.node_id);
  assert.equal(factorPack.node.node_id, factor.node_id);
  assert.equal(factorPack.node.kind, factor.kind);
  assert.throws(() => service.factorDossier("factor-missing"), (error: DomainError) => error.code === "not_found");
});

test("workspace seeds demo book and dossier exposes verification + lock", () => {
  const service = new SponsumService();
  const first = service.workspace();
  assert.ok(first.kpis.receivables >= 5);
  assert.equal(first.kpis.holds_customer_funds, false);
  assert.ok(first.discovery.length >= 1);
  assert.ok(first.disputes.length >= 1);
  assert.ok(first.factors.length >= 3);
  assert.equal(first.policies.CH.legal_bill_of_exchange, "DENY");
  const listed = first.receivables.find((row) => row.invoice_id === "INV-2026-540");
  assert.ok(listed);
  const dossier = service.dossier(listed!.receivable_id);
  assert.ok(dossier.verification);
  assert.ok(dossier.verification!.score >= 50);
  assert.equal(dossier.lock.state, "OFFER_LOCK");
  assert.ok(dossier.events.length > 0);
  const again = service.workspace();
  assert.equal(again.kpis.receivables, first.kpis.receivables);
});

test("acceptLiquidityQuote locks trade and issues settlement without UI payment", () => {
  const service = new SponsumService();
  const asset = seed(service);
  const { offer, quotes } = service.requestLiquidity(asset.receivable_id, "seller-1");
  assert.equal(offer.kind, "RFQ");
  const best = quotes.reduce((lead, quote) => (Number(quote.amount) > Number(lead.amount) ? quote : lead));
  const { trade, instruction } = service.acceptLiquidityQuote(
    asset.receivable_id,
    "seller-1",
    best.buyer,
    best.amount
  );
  assert.equal(trade.status, "SETTLEMENT_PENDING");
  assert.ok(instruction);
  assert.match(instruction!.payee_iban, /^CH/);
  assert.ok(instruction!.payment_reference.startsWith("SPN-"));
  assert.equal(service.getReceivable(asset.receivable_id).status, "TRADE_LOCKED");
  assert.throws(() => service.markPaidFromUi(), (error: DomainError) => error.code === "settlement_requires_provider");
});

test("offer detail stays anonymous at L0 and reveals debtor only after disclosure", () => {
  const service = new SponsumService();
  const asset = seed(service);
  const offer = service.createOffer(asset.receivable_id, { seller_party_id: "seller-1", min_price: "48000" });
  const closed = service.offerDetail(offer.offer_id, "buyer-1");
  assert.equal(closed.level, 0);
  assert.equal(closed.l1, null);
  assert.ok(!JSON.stringify(closed.l0).includes(asset.debtor_party_id));
  service.requestDisclosure(offer.offer_id, "buyer-1", 1);
  const open = service.offerDetail(offer.offer_id, "buyer-1");
  assert.equal(open.level, 1);
  assert.equal(open.l1?.debtor_party_id, asset.debtor_party_id);
  assert.equal(open.l1?.invoice_id, asset.invoice_id);
});

test("disclosure grant is logged; RFQ returns quotes; portfolio lists purchased assets", () => {
  const service = new SponsumService();
  const asset = seed(service);
  const { offer, quotes } = service.requestLiquidity(asset.receivable_id, "seller-1");
  assert.equal(offer.kind, "RFQ");
  assert.equal(quotes.length, 3);
  const grant = service.requestDisclosure(offer.offer_id, "buyer-1", 2);
  assert.equal(grant.level, 2);
  assert.equal(service.disclosures(offer.offer_id).length, 1);
  const bid = service.createBid(offer.offer_id, "buyer-1", quotes[1].amount);
  const trade = service.acceptBid(bid.bid_id, "seller-1");
  const { instruction } = service.getTrade(trade.trade_id);
  service.applySettlementWebhook({
    provider: "external-psp",
    provider_event_id: "pay-ok",
    payment_reference: instruction!.payment_reference,
    observed_amount: instruction!.amount,
    observed_currency: "CHF",
    signed: true
  });
  const book = service.portfolio("buyer-1");
  assert.equal(book.items.length, 1);
  assert.equal(book.items[0].receivable_id, asset.receivable_id);
});
