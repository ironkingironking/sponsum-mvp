import {
  documentSpec,
  formatMoney,
  formatSwissDate,
  partyLines,
  type DisputeContext,
  type DisputeFormTemplate
} from "./dispute-workbench.js";

export const OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";
export const OPENAI_DEFAULT_MODEL = "gpt-5.5";
export const OPENAI_REQUEST_TIMEOUT_MS = 45_000;

export type FormAiSettings = {
  enabled: boolean;
  provider: "openai" | "none";
  endpoint: string;
  model: string;
  apiKey: string;
};

export type FormAiPublicStatus = {
  enabled: boolean;
  provider: "openai" | "none";
  model: string;
};

export function resolveFormAiSettings(env: NodeJS.ProcessEnv = process.env): FormAiSettings {
  const apiKey = (env.OPENAI_API_KEY || env.MOVENA_OCR_PROVIDER_API_KEY || "").trim();
  const endpoint = (env.OPENAI_RESPONSES_ENDPOINT || env.MOVENA_OCR_PROVIDER_ENDPOINT || OPENAI_RESPONSES_ENDPOINT).trim();
  const model = (env.OPENAI_MODEL || env.MOVENA_OCR_PROVIDER_MODEL || OPENAI_DEFAULT_MODEL).trim();
  return {
    enabled: Boolean(apiKey),
    provider: apiKey ? "openai" : "none",
    endpoint,
    model,
    apiKey
  };
}

export function publicFormAiStatus(env: NodeJS.ProcessEnv = process.env): FormAiPublicStatus {
  const settings = resolveFormAiSettings(env);
  return { enabled: settings.enabled, provider: settings.provider, model: settings.model };
}

export function extractOpenAiResponseText(response: unknown): string {
  const payload = response && typeof response === "object" ? (response as Record<string, unknown>) : {};
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  const parts: string[] = [];
  for (const item of Array.isArray(payload.output) ? payload.output : []) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.text === "string") parts.push(row.text);
    for (const content of Array.isArray(row.content) ? row.content : []) {
      if (content && typeof content === "object" && typeof (content as { text?: string }).text === "string") {
        parts.push((content as { text: string }).text);
      }
    }
  }
  return parts.map((part) => part.trim()).filter(Boolean).join("\n");
}

export function formLinesFromModelText(text: string): string[] {
  const lines = text.replace(/\r/g, "").replace(/^#{1,6}\s+/gm, "").split("\n");
  const next: string[] = [];
  for (const raw of lines) {
    const line = raw.replace(/^[-*]\s+/, "").trimEnd();
    if (!line.trim()) {
      if (next.length && next[next.length - 1] !== "") next.push("");
      continue;
    }
    next.push(line.trim());
  }
  while (next[0] === "") next.shift();
  while (next[next.length - 1] === "") next.pop();
  return next.slice(0, 110);
}

export function buildFormAiInput(input: {
  template: DisputeFormTemplate;
  ctx: DisputeContext;
  instruction?: string;
}): { system: string; user: string } {
  const spec = documentSpec(input.template.id);
  const system = [
    "Du bist eine Schreibhilfe für Movena Suite. Du verfasst vollständige Entwürfe schweizerischer Geschäftskorrespondenz und Rechtsschriften auf Hochdeutsch (Schweiz), förmlich und klar.",
    "Du bist keine Anwältin und erteilst keinen Rechtsrat.",
    "Verwende ausschliesslich die gelieferte Aktenlage. Fehlendes als «nicht aktenkundig» bezeichnen. Keine erfundenen Personen, Adressen, IBANs, Aktenzeichen, Fristen, Urteile oder Gesetzesartikel.",
    "Massgeblich ist die aktuelle Inhaberin. Die ursprüngliche Gläubigerin darf nur erwähnt werden, wenn die Aktenlage sie nennt.",
    "Keine Zahlungsauslösung, kein Justitia-Submit, keine eCH-Typen 5/6.",
    "Schreibe ein fertiges Dokument: Absender, Ort/Datum, Empfänger, Betreff, Anrede, Sachverhalt, Begehren, Gruss.",
    "Namen statt technischer IDs. Beträge als CHF 50'000.00. Daten als TT.MM.JJJJ.",
    "Absätze durch Leerzeilen. Kein Markdown, keine Aufzählungssterne ausser nummerierten Rechtsbegehren.",
    "Schliesse mit der Zeile: Entwurf zur Prüfung. Kein Rechtsrat."
  ].join(" ");
  const ctx = input.ctx;
  const user = [
    `Dokumenttyp: ${input.template.title} (${spec.genre}).`,
    `Aufbau: ${spec.structure}.`,
    input.template.summary,
    "",
    "AKTENLAGE — nur diese Fakten verwenden:",
    ...partyLines("Inhaberin / Absenderin", ctx.holder),
    ...partyLines("Ursprüngliche Gläubigerin", ctx.origin_creditor),
    ...partyLines("Schuldnerin / Empfängerin", ctx.debtor),
    `Forderung: ${ctx.receivable_id}`,
    `Rechnung: ${ctx.invoice_id}`,
    `Rechnungsdatum: ${formatSwissDate(ctx.issue_date)}`,
    `Fälligkeit: ${formatSwissDate(ctx.maturity_date)}`,
    `Status: ${ctx.status}`,
    `Nominal: ${formatMoney(ctx.currency, ctx.nominal_amount)}`,
    `Akzeptiert / unbestritten: ${formatMoney(ctx.currency, ctx.accepted_amount)}`,
    `Bestritten: ${formatMoney(ctx.currency, ctx.disputed_amount)}`,
    ctx.outstanding_amount ? `Offen: ${formatMoney(ctx.currency, ctx.outstanding_amount)}` : "",
    ctx.resolve_case_id ? `Resolve: ${ctx.resolve_case_id}` : "Resolve: nicht aktenkundig",
    ctx.eschkg_case_id ? `eSchKG: ${ctx.eschkg_case_id}` : "eSchKG: nicht aktenkundig",
    ctx.ooc_stage ? `Aussergerichtliche Stufe: ${ctx.ooc_stage}` : "",
    ctx.court_stage ? `Staatliche Stufe: ${ctx.court_stage}` : "",
    ctx.venue
      ? `Zuständigkeit (Hinweis, kein Rechtsrat): ${ctx.venue.family_label}${ctx.venue.canton ? `, Kanton ${ctx.venue.canton}` : ""}${ctx.venue.procedure ? `, ${ctx.venue.procedure}` : ""} — ${(ctx.venue.venues || []).map((row) => row.title).join("; ")}`
      : "",
    ctx.venue?.deadlines?.length
      ? `Fristen-Hinweis: ${ctx.venue.deadlines
          .filter((row) => row.days > 0)
          .slice(0, 4)
          .map((row) => `${row.title} ${row.days} Tage (${row.basis}${row.due ? `, Ablauf ${row.due}` : ""})`)
          .join("; ")}`
      : "",
    ...(ctx.fulfilment
      ? [
          `Fulfillment Box: ${ctx.fulfilment.id} (${ctx.fulfilment.status}, Gate ${ctx.fulfilment.billing_gate || "—"})`,
          ctx.fulfilment.monition.kind === "none"
            ? "Gegenpartei-Rüge: keine (noch keine Nicht- oder Schlechterfüllung moniert)."
            : `Gegenpartei-Rüge: ${ctx.fulfilment.monition.kind} — ${(ctx.fulfilment.monition.labels || []).join(", ") || ctx.fulfilment.monition.decision}${ctx.fulfilment.monition.comment ? ` — «${ctx.fulfilment.monition.comment}»` : ""}`
        ]
      : ["Fulfillment Box: nicht aktenkundig"]),
    (ctx.links || []).length
      ? `Verknüpfte Datensätze: ${(ctx.links || []).map((link) => `${link.doctype} «${link.label}» (${link.name})`).join("; ")}`
      : "Verknüpfte Datensätze: keine über das Asset hinaus",
    input.instruction?.trim() ? `Hinweis der Sachbearbeitung: ${input.instruction.trim().slice(0, 800)}` : ""
  ]
    .filter((line) => line !== "")
    .join("\n");
  return { system, user };
}

export async function completeOpenAiFormDraft(
  settings: FormAiSettings,
  input: { system: string; user: string },
  post: typeof fetch = fetch
): Promise<string> {
  if (!settings.enabled) {
    throw new Error("openai_not_configured");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_REQUEST_TIMEOUT_MS);
  try {
    const response = await post(settings.endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: settings.model,
        input: [
          { role: "system", content: input.system },
          { role: "user", content: input.user }
        ]
      })
    });
    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`openai_http_${response.status}`);
    }
    let parsed: unknown = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error("openai_invalid_json");
    }
    const text = extractOpenAiResponseText(parsed);
    if (!text) {
      throw new Error("openai_empty");
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}
