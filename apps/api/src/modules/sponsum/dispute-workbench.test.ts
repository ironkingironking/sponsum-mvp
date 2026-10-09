import assert from "node:assert/strict";
import test from "node:test";

import { DomainError } from "@sponsum/shared";
import { SponsumService } from "./service.js";
import { buildZip } from "./zip.js";
import {
  FORM_TEMPLATES,
  justitiaComposeUrl,
  matchParty,
  renderFormLines
} from "./dispute-workbench.js";
import { setSponsumToday } from "./clock.js";

// Fixtures use maturity dates in autumn 2026; pin «today» so they are not overdue (SPO-03).
setSponsumToday(() => "2026-09-01");

function seedDisputed(service = new SponsumService()) {
  const asset = service.createReceivable({
    invoice_id: `INV-DISP-${Date.now()}`,
    nominal_amount: "50000",
    accepted_amount: "40000",
    disputed_amount: "10000",
    issue_date: "2026-08-01",
    maturity_date: "2026-10-07",
    creditor_party_id: "seller-1",
    debtor_party_id: "debtor-1",
    evidence: { hasInvoice: true, unpaid: true, hasDispute: true }
  });
  service.openDispute(asset.receivable_id, "10000", "resolve-case-workbench");
  return { service, asset: service.getReceivable(asset.receivable_id) };
}

test("zip stores files and starts with PK header", () => {
  const zip = buildZip([
    { name: "manifest.json", data: '{"ok":true}' },
    { name: "cover.txt", data: "hello" }
  ]);
  assert.equal(zip.subarray(0, 2).toString(), "PK");
  assert.ok(zip.length > 80);
});

test("form lines include holder and no-legal-advice disclaimer", () => {
  const lines = renderFormLines("replik", {
    receivable_id: "SPN-1",
    invoice_id: "INV-1",
    status: "DISPUTED",
    currency: "CHF",
    nominal_amount: "100",
    accepted_amount: "80",
    disputed_amount: "20",
    debtor_party_id: "pty_debtor",
    origin_creditor_party_id: "pty_origin",
    current_holder_party_id: "pty_holder",
    resolve_case_id: "resolve-1"
  });
  assert.ok(lines.some((line) => line.includes("pty_holder")));
  assert.ok(lines.some((line) => /kein Rechtsrat/i.test(line)));
  assert.ok(FORM_TEMPLATES.some((row) => row.id === "replik" && row.justitia));
});

test("template letter uses party names and a greeting", () => {
  const lines = renderFormLines("mahnung", {
    receivable_id: "SPN-1",
    invoice_id: "INV-1",
    status: "PARTIALLY_DISPUTED",
    currency: "CHF",
    nominal_amount: "50000",
    accepted_amount: "40000",
    disputed_amount: "10000",
    debtor_party_id: "debtor-1",
    origin_creditor_party_id: "seller-1",
    current_holder_party_id: "seller-1",
    resolve_case_id: "resolve-1",
    debtor: { id: "debtor-1", name: "Nordholz AG", kind: "customer", city: "Winterthur" },
    holder: { id: "seller-1", name: "Movena GmbH", kind: "company", iban: "CH9300762011623852957" },
    maturity_date: "2026-10-07"
  });
  assert.ok(lines.some((line) => /Sehr geehrte Damen und Herren/.test(line)));
  assert.ok(lines.some((line) => /Nordholz AG/.test(line)));
  assert.ok(lines.some((line) => /Movena GmbH/.test(line)));
  assert.ok(lines.some((line) => /CHF 40'000.00|CHF 40’000.00|CHF 40 000.00/.test(line)));
});

test("matchParty prefers ERP names over raw ids", () => {
  const party = matchParty("customer:CUST-NORD", [
    { id: "customer:CUST-NORD", name: "Nordholz AG", kind: "customer", erp_name: "CUST-NORD" }
  ]);
  assert.equal(party.name, "Nordholz AG");
});

test("justitia compose url carries asset and holder", () => {
  const url = justitiaComposeUrl({
    suiteJustitiaUrl: "https://suite.movena.ch/justitia/",
    receivableId: "SPN-CH-1",
    holderPartyId: "pty_holder",
    originCreditorPartyId: "pty_origin"
  });
  assert.ok(url.includes("ref=SPN-CH-1"));
  assert.ok(url.includes("holder=pty_holder"));
  assert.ok(url.includes("origin=pty_origin"));
});

test("dispute workbench tracks, form draft and confirmed export", async () => {
  const { service, asset } = seedDisputed();
  const listed = service.listDisputes().find((row) => row.receivable_id === asset.receivable_id);
  assert.ok(listed);
  assert.equal(listed?.ooc_stage, "resolve");
  assert.ok(listed?.justitia.compose_url.includes(asset.receivable_id));

  const tracked = service.updateDisputeTrack(asset.receivable_id, {
    ooc_stage: "mediation",
    court_stage: "justitia_inbox",
    eschkg_case_id: "ESCHK-1"
  });
  assert.equal(tracked.workbench.ooc_stage, "mediation");
  assert.equal(tracked.workbench.court_stage, "justitia_inbox");
  assert.equal(tracked.workbench.eschkg_case_id, "ESCHK-1");
  const linked = service.linkDispute(asset.receivable_id, [
    { doctype: "Customer", name: "CUST-ALPINE", label: "Alpine Components AG" }
  ]);
  assert.ok(linked.workbench.links.some((row) => row.doctype === "Customer" && row.name === "CUST-ALPINE"));
  assert.ok(linked.catalog.some((row) => row.doctype === "Sales Invoice"));

  assert.throws(
    () => service.updateDisputeTrack(asset.receivable_id, { ooc_stage: "courtroom" }),
    (error: DomainError) => error.code === "validation_error"
  );

  const drafted = await service.generateDisputeForm(asset.receivable_id, "replik", { use_ai: false });
  assert.equal(drafted.form.template_id, "replik");
  assert.equal(drafted.form.source, "template");
  assert.ok(drafted.justitia?.compose_url);
  const pdf = service.disputeFormPdf(asset.receivable_id, drafted.form.id);
  assert.equal(pdf.buffer.subarray(0, 4).toString(), "%PDF");

  assert.throws(
    () => service.createDisputeExport(asset.receivable_id, { recipient: "Kanzlei Meier", confirm: false }),
    (error: DomainError) => error.code === "validation_error"
  );
  const exported = service.createDisputeExport(asset.receivable_id, {
    recipient: "Kanzlei Meier",
    confirm: true
  });
  const zip = service.disputeExportZip(asset.receivable_id, exported.export.id);
  assert.equal(zip.buffer.subarray(0, 2).toString(), "PK");
  assert.match(zip.filename, /briefing/);
});

test("dispute can be opened from a receivable, closed, archived and reopened", () => {
  const service = new SponsumService();
  const asset = service.createReceivable({
    invoice_id: `INV-LIFE-${Date.now()}`,
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
  assert.equal(asset.status, "ACCEPTED");
  const opened = service.createDispute({
    receivable_id: asset.receivable_id,
    disputed_amount: "12000",
    resolve_case_id: "resolve-life"
  });
  assert.equal(opened.asset.status, "PARTIALLY_DISPUTED");
  assert.equal(opened.workbench.lifecycle, "open");
  assert.ok(service.listDisputes("open").some((row) => row.receivable_id === asset.receivable_id));

  assert.throws(
    () => service.closeDispute(asset.receivable_id, { outcome: "settled", confirm: false }),
    (error: DomainError) => error.code === "validation_error"
  );
  const closed = service.closeDispute(asset.receivable_id, {
    confirm: true,
    outcome: "settled",
    asset_action: "restore"
  });
  assert.equal(closed.workbench.lifecycle, "closed");
  assert.equal(closed.workbench.close_outcome, "settled");
  assert.equal(closed.asset.status, "ACCEPTED");
  assert.equal(Number(closed.asset.disputed_amount), 0);
  assert.equal(service.listDisputes("open").filter((row) => row.receivable_id === asset.receivable_id).length, 0);
  assert.ok(service.listDisputes("closed").some((row) => row.receivable_id === asset.receivable_id));

  const archived = service.archiveDispute(asset.receivable_id, { confirm: true });
  assert.equal(archived.workbench.lifecycle, "archived");
  assert.ok(archived.workbench.archived_at);
  const reopened = service.reopenDispute(asset.receivable_id, { disputed_amount: "8000" });
  assert.equal(reopened.workbench.lifecycle, "open");
  assert.equal(reopened.asset.status, "PARTIALLY_DISPUTED");
  assert.equal(reopened.asset.disputed_amount, "8000.00");
});

test("venue and deadlines are available without drafting a letter", async () => {
  const { service, asset } = seedDisputed();
  const dossier = service.disputeDossier(asset.receivable_id);
  assert.ok(dossier.venue);
  assert.equal(dossier.venue.family, "zpo");
  assert.ok(dossier.venue.venues.some((row) => /Art\. 9\/10 ZPO/.test(row.basis || "")));
  const stpo = await service.assessDisputeVenue(asset.receivable_id, { family: "stpo", from: "2026-08-17" });
  assert.equal(stpo.family, "stpo");
  assert.ok(stpo.deadlines.some((row) => row.id === "stpo-strafbefehl" && row.days === 10));
  const tracked = service.updateDisputeTrack(asset.receivable_id, {
    procedure_family: "admin",
    deadline_start: "2026-08-17"
  });
  assert.equal(tracked.workbench.procedure_family, "admin");
  assert.ok(tracked.venue.deadlines.some((row) => /VwVG/.test(row.basis)));
});

test("letters use the holder's seat, never a fixed Zürich (SPO-06)", () => {
  const base = {
    receivable_id: "SPN-1",
    invoice_id: "INV-1",
    status: "PARTIALLY_DISPUTED",
    currency: "CHF",
    nominal_amount: "50000",
    accepted_amount: "40000",
    disputed_amount: "10000",
    debtor_party_id: "debtor-1",
    origin_creditor_party_id: "seller-1",
    current_holder_party_id: "seller-1",
    resolve_case_id: "resolve-1",
    debtor: { id: "debtor-1", name: "Nordholz AG", kind: "customer", city: "Winterthur" }
  };
  const lines = renderFormLines(
    "mahnung",
    {
      ...base,
      holder: {
        id: "seller-1",
        name: "Movena GmbH",
        kind: "company",
        address: "Fassbindstrasse 6, 4310 Rheinfelden",
        city: "Rheinfelden",
        country: "Schweiz"
      }
    },
    "2026-08-17T10:00:00.000Z"
  );
  assert.ok(lines.includes("Rheinfelden, 17.08.2026"));
  assert.ok(lines.includes("Fassbindstrasse 6, 4310 Rheinfelden"));
  assert.ok(!lines.some((line) => /Zürich/.test(line)));
  const unknownSeat = renderFormLines("mahnung", { ...base, holder: { id: "x", name: "Movena GmbH", kind: "company" } }, "2026-08-17T10:00:00.000Z");
  assert.ok(unknownSeat.includes("17.08.2026"));
  assert.ok(!unknownSeat.some((line) => /Zürich/.test(line)));
});
