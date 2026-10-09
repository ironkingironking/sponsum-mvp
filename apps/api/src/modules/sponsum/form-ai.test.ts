import assert from "node:assert/strict";
import test from "node:test";

import { FORM_TEMPLATES } from "./dispute-workbench.js";
import {
  buildFormAiInput,
  completeOpenAiFormDraft,
  extractOpenAiResponseText,
  formLinesFromModelText,
  publicFormAiStatus,
  resolveFormAiSettings
} from "./form-ai.js";
import { SponsumService } from "./service.js";
import { setSponsumToday } from "./clock.js";

// Fixtures use maturity dates in autumn 2026; pin «today» so they are not overdue (SPO-03).
setSponsumToday(() => "2026-09-01");

test("form AI prefers the Suite OpenAI Responses setup", () => {
  const settings = resolveFormAiSettings({
    OPENAI_API_KEY: "sk-test",
    OPENAI_MODEL: "gpt-5.5"
  } as NodeJS.ProcessEnv);
  assert.equal(settings.enabled, true);
  assert.equal(settings.provider, "openai");
  assert.equal(settings.model, "gpt-5.5");
  assert.equal(settings.endpoint, "https://api.openai.com/v1/responses");
  assert.equal(publicFormAiStatus({} as NodeJS.ProcessEnv).enabled, false);
});

test("OpenAI Responses text is extracted without leaking keys", () => {
  const text = extractOpenAiResponseText({
    output_text: "",
    output: [{ content: [{ type: "output_text", text: "Zeile eins\nZeile zwei" }] }]
  });
  assert.match(text, /Zeile eins/);
  assert.deepEqual(formLinesFromModelText("- Zeile eins\n- Zeile zwei"), ["Zeile eins", "Zeile zwei"]);
});

test("generateDisputeForm uses OpenAI when a complete function is injected", async () => {
  const service = new SponsumService();
  const asset = service.createReceivable({
    invoice_id: `INV-AI-${Date.now()}`,
    nominal_amount: "50000",
    accepted_amount: "40000",
    disputed_amount: "10000",
    issue_date: "2026-08-01",
    maturity_date: "2026-10-07",
    creditor_party_id: "seller-1",
    debtor_party_id: "debtor-1",
    evidence: { hasInvoice: true, unpaid: true, hasDispute: true }
  });
  service.openDispute(asset.receivable_id, "10000", "resolve-ai");
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-test";
  try {
    const drafted = await service.generateDisputeForm(asset.receivable_id, "vergleich", {
      instruction: "nur bestrittenen Teil",
      complete: async () => "Vergleich über den bestrittenen Teil\nOhne Anerkennung einer Rechtspflicht"
    });
    assert.equal(drafted.source, "openai");
    assert.ok(drafted.form.lines.some((line) => /bestrittenen Teil/.test(line)));
    assert.ok(drafted.form.lines.some((line) => /Kein Rechtsrat/.test(line)));
    const prompt = buildFormAiInput({
      template: FORM_TEMPLATES.find((row) => row.id === "vergleich")!,
      ctx: {
        receivable_id: asset.receivable_id,
        invoice_id: asset.invoice_id,
        status: "PARTIALLY_DISPUTED",
        currency: "CHF",
        nominal_amount: "50000.00",
        accepted_amount: "40000.00",
        disputed_amount: "10000.00",
        debtor_party_id: "debtor-1",
        origin_creditor_party_id: "seller-1",
        current_holder_party_id: "seller-1",
        resolve_case_id: "resolve-ai",
        debtor: { id: "debtor-1", name: "Nordholz AG", kind: "customer", city: "Winterthur" },
        holder: { id: "seller-1", name: "Movena GmbH", kind: "company", iban: "CH9300762011623852957" },
        links: [{ doctype: "Sales Invoice", name: asset.invoice_id, label: `Rechnung ${asset.invoice_id}` }]
      },
      instruction: "nur bestrittenen Teil"
    });
    assert.match(prompt.system, /Kein Rechtsrat/);
    assert.match(prompt.system, /vollständige Entwürfe/);
    assert.match(prompt.user, /AKTENLAGE/);
    assert.match(prompt.user, /Nordholz AG/);
    assert.match(prompt.user, /Movena GmbH/);
    assert.match(prompt.user, /Sales Invoice/);
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});

test("completeOpenAiFormDraft posts to the Responses endpoint", async () => {
  const calls: Array<{ url: string; body: string }> = [];
  const text = await completeOpenAiFormDraft(
    {
      enabled: true,
      provider: "openai",
      endpoint: "https://api.openai.com/v1/responses",
      model: "gpt-5.5",
      apiKey: "sk-test"
    },
    { system: "sys", user: "usr" },
    async (url, init) => {
      calls.push({ url: String(url), body: String(init?.body || "") });
      return new Response(JSON.stringify({ output_text: "Entwurf" }), { status: 200 });
    }
  );
  assert.equal(text, "Entwurf");
  assert.equal(calls[0]?.url, "https://api.openai.com/v1/responses");
  assert.match(calls[0]?.body || "", /gpt-5.5/);
  assert.doesNotMatch(JSON.stringify(calls), /sk-live/);
});
