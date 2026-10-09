export const OOC_STAGES = ["negotiation", "mediation", "resolve", "settled", "withdrawn"] as const;
export type OutOfCourtStage = (typeof OOC_STAGES)[number];

export const COURT_STAGES = ["idle", "eschkg", "justitia_inbox", "justitia_filed"] as const;
export type CourtStage = (typeof COURT_STAGES)[number];

export const DISPUTE_LIFECYCLES = ["open", "closed", "archived"] as const;
export type DisputeLifecycle = (typeof DISPUTE_LIFECYCLES)[number];

export const DISPUTE_OUTCOMES = ["settled", "withdrawn"] as const;
export type DisputeOutcome = (typeof DISPUTE_OUTCOMES)[number];

export const DISPUTE_ASSET_ACTIONS = ["restore", "close_asset", "keep"] as const;
export type DisputeAssetAction = (typeof DISPUTE_ASSET_ACTIONS)[number];

export type DisputeFormTemplateId =
  | "mahnung"
  | "vergleich"
  | "mediation_einladung"
  | "stellungnahme"
  | "klage_kurz"
  | "replik"
  | "fristwahrung"
  | "akteneinsicht";

export type DisputeFormTemplate = {
  id: DisputeFormTemplateId;
  title: string;
  track: "out_of_court" | "court" | "both";
  justitia: boolean;
  summary: string;
};

export type DisputeFormRecord = {
  id: string;
  template_id: DisputeFormTemplateId;
  title: string;
  created_at: string;
  lines: string[];
  source: "template" | "openai";
};

export type DisputeExportRecord = {
  id: string;
  recipient: string;
  created_at: string;
  filename: string;
};

export const MONIER_KIND = {
  none: "none",
  nichterfuellung: "nichterfuellung",
  schlechterfuellung: "schlechterfuellung",
  beides: "beides",
  sonstige: "sonstige"
} as const;

export type FulfilmentSnapshot = {
  id: string;
  status: string;
  disputed: boolean;
  billing_gate: string | null;
  customer: string | null;
  sales_order_id: string | null;
  quotation_id: string | null;
  profile: string;
  progress: { done: number; required: number };
  monition: {
    kind: (typeof MONIER_KIND)[keyof typeof MONIER_KIND];
    labels: string[];
    comment: string | null;
    decision: string | null;
  };
  desk_url: string;
};

export const LINKABLE_DOCTYPES = [
  "Customer",
  "Company",
  "Sales Invoice",
  "Contract",
  "ReceivableAsset",
  "Assignment",
  "Fulfilment Case",
  "eSchKG Case",
  "Resolve-Case"
] as const;

export type LinkableDoctype = (typeof LINKABLE_DOCTYPES)[number];

export type RecordLink = {
  doctype: LinkableDoctype;
  name: string;
  label: string;
};

export type PartyCard = {
  id: string;
  name: string;
  kind: string;
  erp_name?: string;
  city?: string | null;
  country?: string | null;
  address?: string | null;
  territory?: string | null;
  iban?: string | null;
  tax_id?: string | null;
};

export type DisputeWorkbenchRecord = {
  receivable_id: string;
  ooc_stage: OutOfCourtStage;
  court_stage: CourtStage;
  eschkg_case_id: string | null;
  procedure_family: "zpo" | "stpo" | "admin" | "schkg" | null;
  deadline_start: string | null;
  lifecycle: DisputeLifecycle;
  close_outcome: DisputeOutcome | null;
  closed_at: string | null;
  archived_at: string | null;
  notes: string;
  forms: DisputeFormRecord[];
  exports: DisputeExportRecord[];
  links: RecordLink[];
};

export type DisputeContext = {
  receivable_id: string;
  invoice_id: string;
  status: string;
  currency: string;
  nominal_amount: string;
  accepted_amount: string;
  disputed_amount: string;
  outstanding_amount?: string;
  issue_date?: string;
  maturity_date?: string;
  debtor_party_id: string;
  origin_creditor_party_id: string;
  current_holder_party_id: string;
  resolve_case_id: string | null;
  debtor?: PartyCard;
  holder?: PartyCard;
  origin_creditor?: PartyCard;
  links?: RecordLink[];
  ooc_stage?: OutOfCourtStage;
  court_stage?: CourtStage;
  eschkg_case_id?: string | null;
  fulfilment?: FulfilmentSnapshot | null;
  venue?: {
    family?: string;
    family_label: string;
    canton: string | null;
    procedure?: string | null;
    venues: Array<{ title: string; basis?: string }>;
    deadlines: Array<{ title: string; days: number; basis: string; due?: string | null }>;
  };
};

export const FORM_TEMPLATES: DisputeFormTemplate[] = [
  {
    id: "mahnung",
    title: "Zahlungserinnerung / Mahnung",
    track: "out_of_court",
    justitia: false,
    summary: "Aussergerichtlich. Kein Betreibungsbegehren."
  },
  {
    id: "vergleich",
    title: "Vergleichsvorschlag",
    track: "out_of_court",
    justitia: false,
    summary: "Vorschlag über den bestrittenen Teil. Kein Rechtsrat."
  },
  {
    id: "mediation_einladung",
    title: "Einladung zur Mediation",
    track: "out_of_court",
    justitia: false,
    summary: "Verweist auf Movena Resolve, nicht auf ein Gericht."
  },
  {
    id: "stellungnahme",
    title: "Stellungnahme",
    track: "both",
    justitia: true,
    summary: "Entwurf. Einreichen nur über Justitia mit Bestätigung."
  },
  {
    id: "klage_kurz",
    title: "Eingabe / Klagebegehren (kurz)",
    track: "court",
    justitia: true,
    summary: "Entwurf für eine SUBMISSION. Kein Auto-Submit."
  },
  {
    id: "replik",
    title: "Replik",
    track: "court",
    justitia: true,
    summary: "Antwortentwurf auf eine Zustellung."
  },
  {
    id: "fristwahrung",
    title: "Fristwahrung / Fristerstreckung",
    track: "court",
    justitia: true,
    summary: "Wahrt eine Frist. Kein Rechtsrat."
  },
  {
    id: "akteneinsicht",
    title: "Akteneinsichtsgesuch",
    track: "court",
    justitia: true,
    summary: "CONSULTATION_OF_FILES als Entwurf."
  }
];

export function isOocStage(value: string): value is OutOfCourtStage {
  return (OOC_STAGES as readonly string[]).includes(value);
}

export function isCourtStage(value: string): value is CourtStage {
  return (COURT_STAGES as readonly string[]).includes(value);
}

export function isFormTemplateId(value: string): value is DisputeFormTemplateId {
  return FORM_TEMPLATES.some((row) => row.id === value);
}

export function isDisputeLifecycle(value: string): value is DisputeLifecycle {
  return (DISPUTE_LIFECYCLES as readonly string[]).includes(value);
}

export function isDisputeOutcome(value: string): value is DisputeOutcome {
  return (DISPUTE_OUTCOMES as readonly string[]).includes(value);
}

export function isDisputeAssetAction(value: string): value is DisputeAssetAction {
  return (DISPUTE_ASSET_ACTIONS as readonly string[]).includes(value);
}

export function defaultWorkbench(receivableId: string, resolveCaseId?: string | null): DisputeWorkbenchRecord {
  return {
    receivable_id: receivableId,
    ooc_stage: resolveCaseId ? "resolve" : "negotiation",
    court_stage: "idle",
    eschkg_case_id: null,
    procedure_family: null,
    deadline_start: null,
    lifecycle: "open",
    close_outcome: null,
    closed_at: null,
    archived_at: null,
    notes: "",
    forms: [],
    exports: [],
    links: []
  };
}

export function isLinkableDoctype(value: string): value is LinkableDoctype {
  return (LINKABLE_DOCTYPES as readonly string[]).includes(value);
}

export function addRecordLinks(existing: RecordLink[] | undefined, incoming: RecordLink[]): RecordLink[] {
  const next = [...(existing || [])];
  for (const link of incoming) {
    if (!isLinkableDoctype(link.doctype) || !link.name.trim()) continue;
    const key = `${link.doctype}::${link.name}`;
    if (!next.some((row) => `${row.doctype}::${row.name}` === key)) {
      next.push({
        doctype: link.doctype,
        name: link.name.trim(),
        label: link.label.trim() || link.name.trim()
      });
    }
  }
  return next;
}

export function matchParty(id: string | null | undefined, parties: PartyCard[]): PartyCard {
  const needle = (id || "").trim();
  if (!needle) {
    return { id: "", name: "nicht aktenkundig", kind: "unknown" };
  }
  const compact = needle.toLowerCase();
  const hit =
    parties.find((row) => row.id === needle || row.erp_name === needle || row.name === needle) ||
    parties.find((row) => row.id.toLowerCase() === compact || String(row.erp_name || "").toLowerCase() === compact) ||
    parties.find((row) => compact.includes(String(row.erp_name || "").toLowerCase()) && row.erp_name) ||
    parties.find((row) => compact.replace(/^customer:|^company:|^debtor-|^seller-/, "").includes(row.name.toLowerCase().slice(0, 8)));
  return hit || { id: needle, name: needle.replace(/^(customer:|company:)/, ""), kind: "unknown" };
}

export function formatMoney(currency: string, amount: string): string {
  const n = Number(amount);
  const formatted = Number.isFinite(n)
    ? new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
    : amount;
  return `${currency || "CHF"} ${formatted}`;
}

export function formatSwissDate(iso?: string | null): string {
  const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : iso || "nicht aktenkundig";
}

export function partyLines(role: string, party?: PartyCard): string[] {
  if (!party || !party.name) return [`${role}: nicht aktenkundig`];
  const lines = [`${role}: ${party.name}`];
  if (party.address) lines.push(party.address);
  const cityInAddress = Boolean(party.address && party.city && party.address.includes(party.city));
  const cityLine = [cityInAddress ? null : party.city, party.country].filter(Boolean).join(", ");
  if (cityLine) lines.push(cityLine);
  if (party.iban) lines.push(`IBAN ${party.iban}`);
  if (party.tax_id) lines.push(`UID/MWST ${party.tax_id}`);
  return lines;
}

export function documentSpec(templateId: DisputeFormTemplateId): { genre: string; structure: string } {
  const specs: Record<DisputeFormTemplateId, { genre: string; structure: string }> = {
    mahnung: {
      genre: "kaufmännische Zahlungserinnerung",
      structure:
        "Absender (Inhaber), Ort/Datum, Empfänger (Schuldner), Betreff mit Rechnungsnummer, förmliche Anrede, Sachverhalt, Aufforderung den unbestrittenen Betrag innert 10 Tagen zu zahlen, IBAN falls bekannt, bestrittenen Teil ausdrücklich ausnehmen, Grussformel"
    },
    vergleich: {
      genre: "aussergerichtlicher Vergleichsvorschlag",
      structure:
        "Absender, Ort/Datum, Empfänger, Betreff, Anrede, Sachverhalt, Vergleichssumme nur über den bestrittenen Teil, Vorbehalt ohne Anerkennung einer Rechtspflicht, Wirksamkeit erst nach beidseitiger Unterschrift, Grussformel"
    },
    mediation_einladung: {
      genre: "Einladung zur Mediation / Movena Resolve",
      structure:
        "Absender, Ort/Datum, Empfänger, Betreff, Anrede, Streitgegenstand knapp, Vorschlag Mediation, Hinweis dass gerichtliche Schritte vorbehalten bleiben, Grussformel"
    },
    stellungnahme: {
      genre: "Stellungnahme zur Gegenposition",
      structure:
        "Absender, Ort/Datum, Empfänger, Betreff, Anrede, unbestrittener vs. bestrittener Betrag, eigene Position ohne neue Tatsachen, Frist zur Gegendarstellung, Grussformel"
    },
    klage_kurz: {
      genre: "kurze Eingabe / Klagebegehren",
      structure:
        "Rubrum Kläger (Inhaber) / Beklagte (Schuldner), Streitwert, nummerierte Rechtsbegehren, knappe Begründung aus der Aktenlage, keine erfundenen Gesetzesartikel, Schluss"
    },
    replik: {
      genre: "Replik",
      structure:
        "Rubrum, Bezug auf die gegnerische Eingabe soweit aktenkundig, Entgegnung nur mit gelieferten Fakten, Inhaber bleibt Kläger/Gläubiger, Schluss"
    },
    fristwahrung: {
      genre: "Fristwahrung / Fristerstreckungsgesuch",
      structure:
        "Absender, Ort/Datum, Adressat Behörde falls unbekannt «zuständige Behörde», Aktenzeichen nur wenn geliefert, Gesuch um Erstreckung, Begründung knapp, Schluss"
    },
    akteneinsicht: {
      genre: "Akteneinsichtsgesuch",
      structure:
        "Absender, Ort/Datum, Adressat, Parteistellung, Gesuch um digitale Einsicht, keine Ersatzakte, Schluss"
    }
  };
  return specs[templateId];
}

export function justitiaComposeUrl(input: {
  suiteJustitiaUrl: string;
  receivableId: string;
  holderPartyId: string;
  originCreditorPartyId: string;
}): string {
  const base = input.suiteJustitiaUrl.replace(/\/?$/, "/");
  const query = new URLSearchParams({
    ref: input.receivableId,
    holder: input.holderPartyId,
    origin: input.originCreditorPartyId
  });
  return `${base}?${query.toString()}`;
}

export function renderFormLines(
  templateId: DisputeFormTemplateId,
  ctx: DisputeContext,
  now = new Date().toISOString()
): string[] {
  const date = formatSwissDate(now);
  const place = ctx.holder?.city || ctx.origin_creditor?.city || "";
  const holderName = ctx.holder?.name || ctx.current_holder_party_id;
  const debtorName = ctx.debtor?.name || ctx.debtor_party_id;
  const accepted = formatMoney(ctx.currency, ctx.accepted_amount);
  const disputed = formatMoney(ctx.currency, ctx.disputed_amount);
  const nominal = formatMoney(ctx.currency, ctx.nominal_amount);
  const due = formatSwissDate(ctx.maturity_date);
  const header = [
    ...partyLines("Absender / Inhaber", ctx.holder),
    "",
    place ? `${place}, ${date}` : date,
    "",
    ...partyLines("Empfänger", ctx.debtor),
    "",
    `Betreff: ${FORM_TEMPLATES.find((row) => row.id === templateId)?.title} — Rechnung ${ctx.invoice_id}`,
    "",
    "Sehr geehrte Damen und Herren",
    ""
  ];
  const facts = [
    `Aus der Aktenlage ergibt sich die Forderung ${ctx.receivable_id} aus Rechnung ${ctx.invoice_id}.`,
    `Nominal ${nominal}, akzeptiert ${accepted}, bestritten ${disputed}.`,
    `Fälligkeit ${due}. Status ${ctx.status}.`,
    `Gläubigerin/Inhaberin ist ${holderName}; der frühere Origin-Gläubiger ${ctx.origin_creditor?.name || ctx.origin_creditor_party_id} ist nur nachrangig genannt.`,
    ctx.resolve_case_id ? `Resolve-Fall ${ctx.resolve_case_id}.` : "",
    ctx.eschkg_case_id ? `eSchKG ${ctx.eschkg_case_id}.` : "",
    ctx.venue
      ? `Zuständigkeit (Hinweis, kein Rechtsrat): ${ctx.venue.family_label}${ctx.venue.canton ? `, Kanton ${ctx.venue.canton}` : ""}${ctx.venue.procedure ? ` — ${ctx.venue.procedure}` : ""}${ctx.venue.venues?.[0] ? ` — ${ctx.venue.venues[0].title}` : ""}.`
      : "",
    ctx.fulfilment?.monition.kind && ctx.fulfilment.monition.kind !== "none"
      ? `Die Gegenpartei hat über die Fulfillment Box gerügt (${ctx.fulfilment.monition.kind}): ${(ctx.fulfilment.monition.labels || []).join(", ") || ctx.fulfilment.monition.decision}.`
      : "",
    (ctx.links || []).length
      ? `Verknüpft: ${(ctx.links || []).map((link) => `${link.doctype} ${link.label}`).join("; ")}.`
      : ""
  ].filter(Boolean);
  const bodies: Record<DisputeFormTemplateId, string[]> = {
    mahnung: [
      ...facts,
      "",
      `Wir erinnern an den unbestrittenen Betrag von ${accepted}.`,
      "Bitte überweisen Sie diesen innert 10 Tagen.",
      ctx.holder?.iban ? `Zahlungsempfänger-IBAN: ${ctx.holder.iban}.` : "Die Zahlverbindung teilen wir auf Anfrage mit.",
      `Der bestrittene Teil von ${disputed} bleibt aussergerichtlich offen und ist nicht Gegenstand dieser Erinnerung.`
    ],
    vergleich: [
      ...facts,
      "",
      `Wir schlagen ohne Anerkennung einer Rechtspflicht eine Einigung über den bestrittenen Teil von ${disputed} vor.`,
      "Der Vergleich wird erst mit beidseitiger Unterschrift wirksam.",
      `Der unbestrittene Betrag ${accepted} bleibt unabhängig davon geschuldet.`
    ],
    mediation_einladung: [
      ...facts,
      "",
      `Wir schlagen vor, die Differenz von ${disputed} in einer Mediation bzw. über Movena Resolve zu klären.`,
      "Gerichtliche Schritte bleiben ausdrücklich vorbehalten."
    ],
    stellungnahme: [
      ...facts,
      "",
      `${debtorName} wird ersucht, die Gegenposition zum bestrittenen Betrag innert 10 Tagen darzulegen.`,
      "Neue Tatsachen, die nicht aktenkundig sind, werden hier nicht behauptet."
    ],
    klage_kurz: [
      ...facts,
      "",
      "Rechtsbegehren:",
      `1. ${debtorName} sei zu verpflichten, ${accepted} nebst Verzugszins zu zahlen.`,
      `2. Eventualiter sei über den bestrittenen Betrag von ${disputed} zu entscheiden.`,
      "Begründung: Die Forderung ergibt sich aus der genannten Rechnung und dem Sponsum-Asset. Einreichen nur über Justitia mit Bestätigung."
    ],
    replik: [
      ...facts,
      "",
      "Soweit eine gegnerische Eingabe vorliegt, wird deren Bestreitung der akzeptierten Forderung abgewiesen.",
      `${holderName} bleibt verfügungsberechtigte Inhaberin.`
    ],
    fristwahrung: [
      ...facts,
      "",
      "Die vorliegende Eingabe wahrt die laufende Frist, soweit sie bei der zuständigen Behörde eingereicht wird.",
      "Um kurze Fristerstreckung zur vollständigen Stellungnahme wird ersucht."
    ],
    akteneinsicht: [
      ...facts,
      "",
      `${holderName} ersucht um digitale Akteneinsicht in die zugänglichen Aktenteile.`,
      "Dieses Gesuch ersetzt das Behörden-Dossier nicht."
    ]
  };
  return [
    ...header,
    ...bodies[templateId],
    "",
    "Freundliche Grüsse",
    holderName,
    "",
    "Entwurf zur Prüfung. Kein Rechtsrat. Kein amtliches Formular."
  ];
}

export function briefingManifest(input: {
  ctx: DisputeContext;
  workbench: DisputeWorkbenchRecord;
  exportedAt: string;
  recipient: string;
}): Record<string, unknown> {
  return {
    package: "sponsum-dispute-briefing",
    version: "1.0",
    not: [
      "keine vollständige Justizakte",
      "kein Rechtsrat",
      "kein Justitia-Anwaltspaket",
      "kein Auto-Submit"
    ],
    recipient: input.recipient,
    exported_at: input.exportedAt,
    receivable_id: input.ctx.receivable_id,
    invoice_id: input.ctx.invoice_id,
    holder_party_id: input.ctx.current_holder_party_id,
    origin_creditor_party_id: input.ctx.origin_creditor_party_id,
    resolve_case_id: input.ctx.resolve_case_id,
    ooc_stage: input.workbench.ooc_stage,
    court_stage: input.workbench.court_stage,
    eschkg_case_id: input.workbench.eschkg_case_id,
    procedure_family: input.workbench.procedure_family,
    deadline_start: input.workbench.deadline_start,
    forms: input.workbench.forms.map((row) => ({ id: row.id, template_id: row.template_id, title: row.title }))
  };
}

function inferLifecycle(raw: Partial<DisputeWorkbenchRecord>): DisputeLifecycle {
  if (isDisputeLifecycle(String(raw.lifecycle || ""))) {
    return raw.lifecycle as DisputeLifecycle;
  }
  if (raw.archived_at) return "archived";
  if (raw.closed_at || raw.ooc_stage === "settled" || raw.ooc_stage === "withdrawn") return "closed";
  return "open";
}

export function normalizeWorkbench(raw: Partial<DisputeWorkbenchRecord> | undefined, receivableId: string): DisputeWorkbenchRecord {
  const base = defaultWorkbench(receivableId, null);
  if (!raw) {
    return base;
  }
  return {
    receivable_id: receivableId,
    ooc_stage: isOocStage(String(raw.ooc_stage || "")) ? (raw.ooc_stage as OutOfCourtStage) : base.ooc_stage,
    court_stage: isCourtStage(String(raw.court_stage || "")) ? (raw.court_stage as CourtStage) : base.court_stage,
    eschkg_case_id: raw.eschkg_case_id ?? null,
    procedure_family:
      raw.procedure_family === "zpo" ||
      raw.procedure_family === "stpo" ||
      raw.procedure_family === "admin" ||
      raw.procedure_family === "schkg"
        ? raw.procedure_family
        : null,
    deadline_start: raw.deadline_start ?? null,
    lifecycle: inferLifecycle(raw),
    close_outcome: isDisputeOutcome(String(raw.close_outcome || "")) ? (raw.close_outcome as DisputeOutcome) : null,
    closed_at: raw.closed_at ?? null,
    archived_at: raw.archived_at ?? null,
    notes: raw.notes ?? "",
    forms: Array.isArray(raw.forms)
      ? raw.forms.map((form) => ({
          ...form,
          source: form.source === "openai" ? "openai" : "template"
        }))
      : [],
    exports: Array.isArray(raw.exports) ? raw.exports : [],
    links: Array.isArray(raw.links) ? addRecordLinks([], raw.links) : []
  };
}
