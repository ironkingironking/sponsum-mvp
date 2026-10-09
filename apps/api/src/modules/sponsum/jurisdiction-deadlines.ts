import type { DisputeContext, PartyCard } from "./dispute-workbench.js";

export const PROCEDURE_FAMILIES = ["zpo", "stpo", "admin", "schkg"] as const;
export type ProcedureFamily = (typeof PROCEDURE_FAMILIES)[number];

export type VenueHint = {
  title: string;
  basis: string;
  detail: string;
};

export type DeadlineHint = {
  id: string;
  title: string;
  days: number;
  basis: string;
  start: string | null;
  due: string | null;
  note: string;
  /** Fristregeln, die in die Berechnung eingegangen sind (Stillstand, Betreibungsferien, Feiertage). */
  rules: string[];
};

/**
 * Berechnungsregime einer Frist:
 * - zpo: Art. 142 ff. ZPO mit Stillstand nach Art. 145 Abs. 1 / Art. 146 ZPO
 * - zpo-summary: summarisches oder Schlichtungsverfahren, kein Stillstand (Art. 145 Abs. 2 ZPO)
 * - federal-admin: Art. 20–22a VwVG bzw. Art. 44–46 BGG, gleiche Stillstandsperioden
 * - stpo: Art. 90 StPO, keine Gerichtsferien (Art. 89 Abs. 2 StPO)
 * - schkg: Art. 31 SchKG mit Betreibungsferien (Art. 56 Ziff. 2, Art. 63 SchKG)
 * - fiction: Zustellfiktion nach 7 Kalendertagen, ohne Verschiebung
 */
export type DeadlineRegime = "zpo" | "zpo-summary" | "federal-admin" | "stpo" | "schkg" | "fiction";

export type LegalDeadline = {
  due: string;
  /** Tag, ab dem gezählt wird (Tag nach der wirksamen Zustellung). */
  counting_from: string;
  rules: string[];
};

export type JurisdictionAssessment = {
  family: ProcedureFamily;
  family_label: string;
  inferred: boolean;
  canton: string | null;
  canton_source: string;
  streitwert: number | null;
  procedure: string | null;
  venues: VenueHint[];
  authorities: VenueHint[];
  deadlines: DeadlineHint[];
  disclaimer: string;
};

const CANTON_CODES = new Set([
  "AG",
  "AI",
  "AR",
  "BE",
  "BL",
  "BS",
  "FR",
  "GE",
  "GL",
  "GR",
  "JU",
  "LU",
  "NE",
  "NW",
  "OW",
  "SG",
  "SH",
  "SO",
  "SZ",
  "TG",
  "TI",
  "UR",
  "VD",
  "VS",
  "ZG",
  "ZH"
]);

const CITY_CANTON: Record<string, string> = {
  zürich: "ZH",
  zurich: "ZH",
  winterthur: "ZH",
  uster: "ZH",
  dübendorf: "ZH",
  duebendorf: "ZH",
  dietikon: "ZH",
  wädenswil: "ZH",
  waedenswil: "ZH",
  horgen: "ZH",
  bülach: "ZH",
  buelach: "ZH",
  kloten: "ZH",
  wetzikon: "ZH",
  bern: "BE",
  biel: "BE",
  "biel/bienne": "BE",
  thun: "BE",
  burgdorf: "BE",
  interlaken: "BE",
  luzern: "LU",
  emmen: "LU",
  "stadt luzern": "LU",
  "st. gallen": "SG",
  "sankt gallen": "SG",
  rapperswil: "SG",
  "rapperswil-jona": "SG",
  wil: "SG",
  aarau: "AG",
  baden: "AG",
  wettingen: "AG",
  brugg: "AG",
  rheinfelden: "AG",
  basel: "BS",
  liestal: "BL",
  allschwil: "BL",
  lausanne: "VD",
  yverdon: "VD",
  "yverdon-les-bains": "VD",
  nyon: "VD",
  vevey: "VD",
  montreux: "VD",
  genève: "GE",
  geneve: "GE",
  genf: "GE",
  geneva: "GE",
  lugano: "TI",
  bellinzona: "TI",
  locarno: "TI",
  sion: "VS",
  sitten: "VS",
  sierre: "VS",
  chur: "GR",
  davos: "GR",
  fribourg: "FR",
  freiburg: "FR",
  solothurn: "SO",
  olten: "SO",
  grenchen: "SO",
  schaffhausen: "SH",
  frauenfeld: "TG",
  kreuzlingen: "TG",
  weinfelden: "TG",
  schwyz: "SZ",
  einsiedeln: "SZ",
  zug: "ZG",
  baar: "ZG",
  sarnen: "OW",
  stans: "NW",
  altdorf: "UR",
  glarus: "GL",
  appenzell: "AI",
  herisau: "AR",
  delemont: "JU",
  delémont: "JU",
  neuchatel: "NE",
  neuchâtel: "NE",
  "la chaux-de-fonds": "NE"
};

/** Unambiguous 2-digit PLZ prefixes. Border zones stay unmapped. */
const PLZ_PREFIX_CANTON: Record<string, string> = {
  "12": "GE",
  "30": "BE",
  "31": "BE",
  "40": "BS",
  "60": "LU",
  "63": "ZG",
  "65": "TI",
  "66": "TI",
  "69": "TI",
  "70": "GR",
  "80": "ZH",
  "81": "ZH",
  "83": "ZH",
  "84": "ZH",
  "86": "ZH",
  "82": "SH",
  "85": "TG"
};

const FAMILY_LABEL: Record<ProcedureFamily, string> = {
  zpo: "Zivilprozess (ZPO)",
  stpo: "Strafprozess (StPO)",
  admin: "Verwaltungsrechtspflege (VwVG / kant. VRPG)",
  schkg: "Schuldbetreibung (SchKG)"
};

const FIXED_HOLIDAYS = new Set(["01-01", "01-02", "08-01", "12-25", "12-26"]);

type CantonOrg = {
  first: string;
  appeal: string;
  peace: string;
  prosecution: string;
  criminal: string;
  admin: string;
  betreibung: string;
};

const CANTON_ORG: Record<string, CantonOrg> = {
  ZH: {
    first: "Bezirksgericht des Wohnsitz-/Sitzbezirks (ZH)",
    appeal: "Obergericht des Kantons Zürich",
    peace: "Friedensrichteramt / Schlichtungsbehörde am Wohnsitz der beklagten Partei",
    prosecution: "Staatsanwaltschaft des Kantons Zürich",
    criminal: "Bezirksgericht als Strafgericht; Obergericht ZH",
    admin: "Verwaltungsgericht des Kantons Zürich",
    betreibung: "Betreibungsamt am Wohnsitz bzw. Sitz (ZH)"
  },
  BE: {
    first: "Regionalgericht (Kanton Bern)",
    appeal: "Obergericht des Kantons Bern",
    peace: "Schlichtungsbehörde am Wohnsitz der beklagten Partei",
    prosecution: "Generalstaatsanwaltschaft / regionale Staatsanwaltschaft Bern",
    criminal: "Regionalgericht als Strafgericht; Obergericht BE",
    admin: "Verwaltungsgericht des Kantons Bern",
    betreibung: "Betreibungsamt am Wohnsitz bzw. Sitz (BE)"
  },
  AG: {
    first: "Bezirksgericht (Kanton Aargau)",
    appeal: "Obergericht des Kantons Aargau",
    peace: "Friedensrichteramt / Schlichtungsbehörde",
    prosecution: "Staatsanwaltschaft des Kantons Aargau",
    criminal: "Bezirksgericht als Strafgericht; Obergericht AG",
    admin: "Verwaltungsgericht des Kantons Aargau",
    betreibung: "Betreibungsamt am Wohnsitz bzw. Sitz (AG)"
  },
  SG: {
    first: "Kreisgericht (Kanton St. Gallen)",
    appeal: "Kantonsgericht St. Gallen",
    peace: "Vermittleramt / Schlichtungsbehörde",
    prosecution: "Staatsanwaltschaft des Kantons St. Gallen",
    criminal: "Kreisgericht als Strafgericht; Kantonsgericht SG",
    admin: "Verwaltungsgericht des Kantons St. Gallen",
    betreibung: "Betreibungsamt am Wohnsitz bzw. Sitz (SG)"
  },
  LU: {
    first: "Bezirksgericht (Kanton Luzern)",
    appeal: "Kantonsgericht Luzern",
    peace: "Schlichtungsbehörde",
    prosecution: "Staatsanwaltschaft des Kantons Luzern",
    criminal: "Bezirksgericht als Strafgericht; Kantonsgericht LU",
    admin: "Kantonsgericht Luzern, Verwaltungsrechtliche Abteilung",
    betreibung: "Betreibungsamt am Wohnsitz bzw. Sitz (LU)"
  },
  BS: {
    first: "Zivilgericht Basel-Stadt",
    appeal: "Appellationsgericht Basel-Stadt",
    peace: "Friedensbüreau Basel-Stadt",
    prosecution: "Staatsanwaltschaft Basel-Stadt",
    criminal: "Strafgericht Basel-Stadt; Appellationsgericht",
    admin: "Appellationsgericht Basel-Stadt als Verwaltungsgericht",
    betreibung: "Betreibungsamt Basel-Stadt"
  },
  BL: {
    first: "Zivilkreisgericht (Basel-Landschaft)",
    appeal: "Kantonsgericht Basel-Landschaft",
    peace: "Friedensrichteramt",
    prosecution: "Staatsanwaltschaft Basel-Landschaft",
    criminal: "Strafgericht BL; Kantonsgericht BL",
    admin: "Kantonsgericht Basel-Landschaft",
    betreibung: "Betreibungsamt am Wohnsitz bzw. Sitz (BL)"
  },
  GE: {
    first: "Tribunal de première instance (Genève)",
    appeal: "Cour de justice Genève",
    peace: "Tribunal des prud'hommes / autorité de conciliation",
    prosecution: "Ministère public de Genève",
    criminal: "Tribunal correctionnel / Cour de justice",
    admin: "Chambre administrative de la Cour de justice",
    betreibung: "Office des poursuites de Genève"
  },
  VD: {
    first: "Tribunal d'arrondissement (Vaud)",
    appeal: "Tribunal cantonal vaudois",
    peace: "Autorité de conciliation",
    prosecution: "Ministère public vaudois",
    criminal: "Tribunal correctionnel; Tribunal cantonal",
    admin: "Cour de droit administratif et public (VD)",
    betreibung: "Office des poursuites du domicile / siège"
  },
  TI: {
    first: "Pretura (Ticino)",
    appeal: "Tribunale di appello del Cantone Ticino",
    peace: "Ufficio di conciliazione",
    prosecution: "Ministero pubblico del Cantone Ticino",
    criminal: "Pretura penale; Tribunale di appello",
    admin: "Tribunale cantonale amministrativo",
    betreibung: "Ufficio di esecuzione e fallimenti"
  }
};

export function isProcedureFamily(value: string): value is ProcedureFamily {
  return (PROCEDURE_FAMILIES as readonly string[]).includes(value);
}

function orgFor(canton: string | null): CantonOrg {
  if (canton && CANTON_ORG[canton]) return CANTON_ORG[canton];
  const tag = canton ? `Kanton ${canton}` : "zuständiger Kanton";
  return {
    first: `Erstinstanzliches Gericht (${tag})`,
    appeal: `Obergericht / Kantonsgericht (${tag})`,
    peace: `Schlichtungsbehörde / Friedensrichter (${tag})`,
    prosecution: `Staatsanwaltschaft (${tag})`,
    criminal: `Strafgericht erster Instanz (${tag})`,
    admin: `Verwaltungsgericht (${tag})`,
    betreibung: `Betreibungsamt am Wohnsitz bzw. Sitz (${tag})`
  };
}

function normalizeCity(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^ch[-\s]+/i, "")
    .replace(/^\d{4}\s+/, "")
    .replace(/\s*\(([a-z]{2})\)\s*$/i, "")
    .replace(/\s+([a-z]{2})$/i, (_, code: string) => (CANTON_CODES.has(code.toUpperCase()) ? "" : ` ${code}`))
    .trim();
}

function extractPlz(text: string): string | null {
  const match = text.match(/\b(\d{4})\b/);
  return match ? match[1] : null;
}

function cantonFromPlz(plz: string | null): string | null {
  if (!plz) return null;
  return PLZ_PREFIX_CANTON[plz.slice(0, 2)] || null;
}

function cantonFromBlob(blob: string): string | null {
  const upper = blob.toUpperCase();
  const tagged = upper.match(/\bKANTON\s+([A-Z]{2})\b/) || upper.match(/\(([A-Z]{2})\)/);
  if (tagged && CANTON_CODES.has(tagged[1])) return tagged[1];
  for (const [city, canton] of Object.entries(CITY_CANTON)) {
    if (blob.toLowerCase().includes(city)) return canton;
  }
  return cantonFromPlz(extractPlz(blob));
}

export function inferCanton(party?: PartyCard | null): { canton: string | null; source: string } {
  const territory = String(party?.territory || "").trim().toUpperCase();
  if (CANTON_CODES.has(territory)) {
    return { canton: territory, source: `Territorium ${territory}` };
  }
  const cityRaw = String(party?.city || "").trim();
  const city = normalizeCity(cityRaw);
  if (city && CITY_CANTON[city]) {
    return { canton: CITY_CANTON[city], source: `Ort ${party?.city}` };
  }
  const cityPlz = cantonFromPlz(extractPlz(cityRaw));
  if (cityPlz) {
    return { canton: cityPlz, source: `PLZ in Ortsangabe ${cityRaw}` };
  }
  const address = String(party?.address || "").trim();
  const fromAddress = cantonFromBlob(address);
  if (fromAddress) {
    return { canton: fromAddress, source: `Adresse ${address}` };
  }
  const country = String(party?.country || "").toLowerCase();
  if (country && !/schweiz|switzerland|suisse|svizzera|^ch$/.test(country)) {
    return { canton: null, source: `Ausland (${party?.country}) — internationaler Gerichtsstand prüfen` };
  }
  return { canton: null, source: "Kanton nicht aktenkundig" };
}

export function inferFamily(ctx: DisputeContext): ProcedureFamily {
  const blob = [
    ctx.court_stage,
    ctx.ooc_stage,
    ctx.eschkg_case_id,
    ...(ctx.links || []).map((row) => `${row.doctype} ${row.label}`)
  ]
    .join(" ")
    .toLowerCase();
  if (ctx.eschkg_case_id || /eschkg|betreibung|zahlungsbefehl/.test(blob)) return "schkg";
  if (/\bstpo\b|strafbefehl|staatsanwalt|strafrecht/.test(blob)) return "stpo";
  if (/verwalt|vwvg|vrpg|verfügung/.test(blob)) return "admin";
  return "zpo";
}

/** Anonymous Gregorian algorithm — Easter Sunday UTC. */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function isoUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function isSwissFederalHoliday(date: Date): boolean {
  const md = `${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  if (FIXED_HOLIDAYS.has(md)) return true;
  const easter = easterSunday(date.getUTCFullYear());
  const moving = new Set([
    isoUtc(shiftDays(easter, -2)),
    isoUtc(shiftDays(easter, 1)),
    isoUtc(shiftDays(easter, 39)),
    isoUtc(shiftDays(easter, 50))
  ]);
  return moving.has(isoUtc(date));
}

export function nextSwissBusinessDay(date: Date): Date {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  for (let i = 0; i < 16; i += 1) {
    const wd = next.getUTCDay();
    if (wd !== 0 && wd !== 6 && !isSwissFederalHoliday(next)) return next;
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

/** Frist beginnt am Tag nach der Zustellung; letzter Tag auf Sa/So/Feiertag verlängert sich. Ohne Stillstand. */
export function addSwissLegalDays(startIso: string, days: number): string {
  const match = startIso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match || days < 0) return "";
  const start = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 1));
  start.setUTCDate(start.getUTCDate() + days - 1);
  return isoUtc(nextSwissBusinessDay(start));
}

function parseIsoUtc(iso: string): Date | null {
  const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCMonth() === Number(match[2]) - 1 ? date : null;
}

function monthDay(date: Date): number {
  return (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
}

function inEasterWindow(date: Date): boolean {
  const easter = easterSunday(date.getUTCFullYear());
  const t = date.getTime();
  return t >= shiftDays(easter, -7).getTime() && t <= shiftDays(easter, 7).getTime();
}

/**
 * Stillstand der Fristen nach Art. 145 Abs. 1 ZPO (gleich Art. 22a VwVG, Art. 46 BGG):
 * 7. Tag vor bis und mit 7. Tag nach Ostern, 15.07.–15.08., 18.12.–02.01.
 */
export function courtStandstill(date: Date): string | null {
  if (inEasterWindow(date)) return "Ostern";
  const md = monthDay(date);
  if (md >= 715 && md <= 815) return "Sommer (15.07.–15.08.)";
  if (md >= 1218 || md <= 102) return "Weihnachten/Neujahr (18.12.–02.01.)";
  return null;
}

/** Betreibungsferien nach Art. 56 Ziff. 2 SchKG: je 7 Tage vor und nach Ostern und Weihnachten, 15.–31. Juli. */
export function debtEnforcementHoliday(date: Date): string | null {
  if (inEasterWindow(date)) return "Ostern";
  const md = monthDay(date);
  if (md >= 715 && md <= 731) return "Juli (15.–31.07.)";
  if (md >= 1218 || md <= 101) return "Weihnachten (18.12.–01.01.)";
  return null;
}

function isBusinessDay(date: Date): boolean {
  const wd = date.getUTCDay();
  return wd !== 0 && wd !== 6 && !isSwissFederalHoliday(date);
}

const RULE_WEEKEND = "Ende auf Samstag, Sonntag oder Feiertag: nächster Werktag";
const RULE_NO_CANTONAL = "ohne kantonale Feiertage am Gerichtsort (bitte prüfen, Art. 142 Abs. 3 ZPO)";

/**
 * Fristende nach Schweizer Verfahrensrecht. `deliveryIso` ist der Tag der Zustellung;
 * gezählt wird ab dem Folgetag. Liefert null bei ungültigem Datum.
 */
export function computeLegalDeadline(deliveryIso: string, days: number, regime: DeadlineRegime): LegalDeadline | null {
  const delivery = parseIsoUtc(deliveryIso);
  if (!delivery || !Number.isFinite(days) || days < 0) return null;
  const rules: string[] = [];

  if (regime === "fiction") {
    const due = shiftDays(delivery, days);
    return {
      due: isoUtc(due),
      counting_from: isoUtc(shiftDays(delivery, 1)),
      rules: ["Zustellfiktion: Kalendertage, keine Verschiebung auf Werktage und kein Stillstand"]
    };
  }

  if (regime === "zpo" || regime === "federal-admin") {
    const basis = regime === "zpo" ? "Art. 145/146 ZPO" : "Art. 22a VwVG / Art. 46 BGG";
    let day = shiftDays(delivery, 1);
    let countingFrom: Date | null = null;
    let counted = 0;
    const skipped = new Set<string>();
    for (let guard = 0; guard < 1000; guard += 1) {
      const period = courtStandstill(day);
      if (period) {
        skipped.add(period);
      } else {
        if (!countingFrom) countingFrom = day;
        counted += 1;
        if (counted >= days) break;
      }
      day = shiftDays(day, 1);
    }
    if (days === 0) day = delivery;
    let moved = false;
    for (let guard = 0; guard < 60 && (!isBusinessDay(day) || courtStandstill(day)); guard += 1) {
      if (courtStandstill(day)) skipped.add(courtStandstill(day) as string);
      day = shiftDays(day, 1);
      moved = true;
    }
    if (courtStandstill(delivery)) {
      rules.push(`Zustellung im Stillstand ${courtStandstill(delivery)}: Fristbeginn am ersten Tag danach (${basis})`);
    }
    if (skipped.size) rules.push(`Stillstand ${[...skipped].join(", ")} nicht mitgezählt (${basis})`);
    else rules.push(`Stillstand geprüft, nicht betroffen (${basis})`);
    if (moved) rules.push(RULE_WEEKEND);
    if (regime === "zpo") rules.push(RULE_NO_CANTONAL);
    else rules.push("kantonale Verfahrensgesetze können andere Stillstände vorsehen");
    return { due: isoUtc(day), counting_from: isoUtc(countingFrom || shiftDays(delivery, 1)), rules };
  }

  if (regime === "schkg") {
    // Eine Betreibungshandlung in den Ferien wirkt erst am ersten Tag danach.
    let effective = delivery;
    if (debtEnforcementHoliday(delivery)) {
      const period = debtEnforcementHoliday(delivery);
      while (debtEnforcementHoliday(shiftDays(effective, 1))) effective = shiftDays(effective, 1);
      effective = shiftDays(effective, 1);
      rules.push(`Zustellung in den Betreibungsferien ${period}: wirksam am ersten Tag danach (Art. 56 SchKG)`);
      // Der Wirkungstag zählt als Zustellung; gezählt wird ab dem Folgetag.
    }
    let day = shiftDays(effective, days);
    if (!isBusinessDay(day)) {
      while (!isBusinessDay(day)) day = shiftDays(day, 1);
      rules.push("Ende auf Samstag, Sonntag oder Feiertag: nächster Werktag (Art. 31 Abs. 3 SchKG)");
    }
    const ferien = debtEnforcementHoliday(day);
    if (ferien) {
      while (debtEnforcementHoliday(day)) day = shiftDays(day, 1);
      // `day` ist der erste Tag nach den Ferien; Fristende ist der dritte Werktag danach.
      let business = 0;
      day = shiftDays(day, -1);
      while (business < 3) {
        day = shiftDays(day, 1);
        if (isBusinessDay(day)) business += 1;
      }
      rules.push(`Ende in den Betreibungsferien ${ferien}: verlängert bis zum 3. Werktag danach (Art. 63 SchKG)`);
    } else {
      rules.push("Betreibungsferien geprüft, Ende nicht betroffen (Art. 56/63 SchKG)");
    }
    rules.push("ohne kantonale Feiertage am Betreibungsort");
    return { due: isoUtc(day), counting_from: isoUtc(shiftDays(effective, 1)), rules };
  }

  // stpo and zpo-summary: no court holidays
  const due = addSwissLegalDays(isoUtc(delivery), days);
  rules.push(
    regime === "stpo"
      ? "keine Gerichtsferien im Strafverfahren (Art. 89 Abs. 2 StPO)"
      : "kein Stillstand im summarischen und im Schlichtungsverfahren (Art. 145 Abs. 2 ZPO)"
  );
  if (due !== isoUtc(shiftDays(delivery, days))) rules.push(RULE_WEEKEND);
  rules.push(regime === "stpo" ? "ohne kantonale Feiertage" : RULE_NO_CANTONAL);
  return { due, counting_from: isoUtc(shiftDays(delivery, 1)), rules };
}

function formatCh(iso: string | null): string {
  if (!iso) return "—";
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : iso;
}

function deadline(
  id: string,
  title: string,
  days: number,
  basis: string,
  start: string | null,
  note: string,
  regime: DeadlineRegime
): DeadlineHint {
  const computed = start ? computeLegalDeadline(start, days, regime) : null;
  const due = computed ? computed.due : null;
  return {
    id,
    title,
    days,
    basis,
    start,
    due,
    rules: computed ? computed.rules : [],
    note: due ? `${note} Ablauf voraussichtlich ${formatCh(due)}.` : note
  };
}

export function assessJurisdiction(
  ctx: DisputeContext,
  options: { family?: string; from?: string | null } = {}
): JurisdictionAssessment {
  const inferred = !options.family || !isProcedureFamily(options.family);
  const family = inferred ? inferFamily(ctx) : (options.family as ProcedureFamily);
  const defendant = ctx.debtor;
  const holder = ctx.holder;
  const { canton, source } = inferCanton(defendant);
  const holderCanton = inferCanton(holder);
  const streitwert = Number(ctx.nominal_amount || ctx.outstanding_amount || ctx.disputed_amount);
  const amount = Number.isFinite(streitwert) ? streitwert : null;
  const start = options.from || ctx.issue_date || null;
  const cantonLabel = canton || "Wohnsitz/Sitz der beklagten Partei";
  const org = orgFor(canton);

  const venues: VenueHint[] = [];
  const authorities: VenueHint[] = [];
  const deadlines: DeadlineHint[] = [];
  let procedure: string | null = null;

  if (family === "zpo") {
    const simplified = amount !== null && amount <= 30000;
    const appealable = amount === null || amount > 10000;
    procedure = simplified ? "Vereinfachtes Verfahren (Art. 243 ZPO)" : "Ordentliches Verfahren";
    venues.push({
      title: `Allgemeiner Gerichtsstand ${cantonLabel}`,
      basis: "Art. 9/10 ZPO",
      detail: `Wohnsitz bzw. Sitz der beklagten Partei (${ctx.debtor?.name || ctx.debtor_party_id}). ${source}.`
    });
    venues.push({
      title: "Wahlgerichtsstand Erfüllungsort",
      basis: "Art. 31 ZPO",
      detail: "Für vertragliche Klagen zusätzlich am Erfüllungsort — nur wenn dieser aktenkundig ist."
    });
    venues.push({
      title: "Gerichtsstandsvereinbarung",
      basis: "Art. 17 ZPO",
      detail: "Eine abweichende Vereinbarung geht vor, sofern sie gültig und aktenkundig ist. Hier nicht geprüft."
    });
    authorities.push({
      title: org.peace,
      basis: "Art. 197 ff. ZPO",
      detail: "In der Regel vorgängiges Schlichtungsverfahren; Ausnahmen Art. 198 ZPO (u. a. klare Fälle, Vereinbarung)."
    });
    authorities.push({
      title: simplified ? `${org.first} — Einzelgericht, vereinfacht` : `${org.first} — Kollegialgericht erster Instanz`,
      basis: simplified ? "Art. 243 ZPO" : "Art. 219 ff. ZPO",
      detail: amount !== null ? `Streitwert aus Aktenlage ${amount.toFixed(2)} CHF.` : "Streitwert nicht berechnet."
    });
    authorities.push({
      title: org.appeal,
      basis: appealable ? "Art. 308 / 311 ZPO" : "Art. 308 ZPO (Berufung i. d. R. unzulässig)",
      detail: appealable
        ? "Berufung gegen Endentscheide, soweit der Streitwert über CHF 10'000 liegt oder eine bundesrechtliche Streitigkeit vorliegt."
        : "Unter CHF 10'000 in der Regel nur Beschwerde (Art. 319 ff. ZPO), keine Berufung."
    });
    deadlines.push(
      deadline(
        "zpo-antwort",
        "Klageantwort / Stellungnahme",
        20,
        "Art. 222 ZPO (gerichtliche Frist, oft 20 Tage)",
        start,
        "Die genaue Frist setzt das Gericht; 20 Tage sind ein häufiger Ansatz, kein Automatismus.", "zpo")
    );
    deadlines.push(
      deadline(
        "zpo-berufung",
        "Berufung",
        30,
        "Art. 311 ZPO",
        start,
        "Ab Zustellung des erstinstanzlichen Entscheids. Zulässigkeit nach Art. 308 ZPO prüfen. Massgebend ist die Zustellung des begründeten Entscheids, nicht der Fristbeginn oben.", "zpo")
    );
    deadlines.push(
      deadline(
        "zpo-beschwerde",
        "Beschwerde",
        30,
        "Art. 321 ZPO",
        start,
        "Gegen erstinstanzliche Entscheide, soweit die Beschwerde zulässig ist. Im summarischen Verfahren gilt kein Stillstand (Art. 145 Abs. 2 ZPO).", "zpo")
    );
  }

  if (family === "stpo") {
    venues.push({
      title: "Tatort",
      basis: "Art. 31 Abs. 1 StPO",
      detail: "Vorrangig der Ort der angeblichen Tat. Aus einer Forderung allein nicht ableitbar."
    });
    venues.push({
      title: `Wohnsitz der beschuldigten Person ${cantonLabel}`,
      basis: "Art. 31 Abs. 1 StPO",
      detail: `${source}. Alternativ Ergreifungsort.`
    });
    venues.push({
      title: "Ergreifungsort",
      basis: "Art. 31 Abs. 1 StPO",
      detail: "Zuständig ist auch der Ort, an dem die beschuldigte Person ergriffen wurde."
    });
    authorities.push({
      title: org.prosecution,
      basis: "Art. 16 / 31 StPO",
      detail: "Ermittlungen, Anklage, Strafbefehl."
    });
    authorities.push({
      title: org.criminal,
      basis: "Art. 18 / 19 StPO",
      detail: "Zwangsmassnahmengericht bzw. Sachgericht nach Verfahrensstadium."
    });
    deadlines.push(
      deadline(
        "stpo-strafbefehl",
        "Einsprache gegen Strafbefehl",
        10,
        "Art. 354 Abs. 1 StPO",
        start,
        "Schriftlich bei der Staatsanwaltschaft. Zustellfiktion bei unangeforderter Sendung beachten.", "stpo")
    );
    deadlines.push(
      deadline("stpo-berufung", "Berufung", 10, "Art. 399 StPO", start, "Ab Eröffnung des erstinstanzlichen Urteils.", "stpo")
    );
    deadlines.push(
      deadline(
        "stpo-beschwerde",
        "Beschwerde",
        10,
        "Art. 396 StPO",
        start,
        "Gegen verfahrensleitende Entscheide, soweit zulässig.", "stpo")
    );
  }

  if (family === "admin") {
    authorities.push({
      title: "Verfügende Verwaltungsbehörde",
      basis: "VwVG / kantonale VRPG",
      detail: "Zuerst die Behörde, die verfügt hat. Der genaue Instanzenzug ist kantonal bzw. bundesrechtlich."
    });
    venues.push({
      title: org.admin,
      basis: "kant. VRPG / VRG",
      detail: "Nach kantonalem Recht; Abweichungen je Kanton prüfen."
    });
    venues.push({
      title: "Bundesverwaltungsgericht / Bundesgericht",
      basis: "VwVG / BGG",
      detail: "Bei Bundesverfügungen bzw. nach Ausschöpfung des kantonalen Zugs."
    });
    deadlines.push(
      deadline(
        "vwvg-beschwerde",
        "Beschwerde gegen Verfügung",
        30,
        "Art. 50 VwVG (Bund); viele VRPG analog 30 Tage",
        start,
        "Kantonales Recht kann kürzer oder anders ansetzen — VRPG des zuständigen Kantons lesen.", "federal-admin")
    );
    deadlines.push(
      deadline(
        "bgg",
        "Beschwerde ans Bundesgericht",
        30,
        "Art. 100 BGG",
        start,
        "Nur gegen letztinstanzliche Entscheide, soweit zulässig.", "federal-admin")
    );
  }

  if (family === "schkg") {
    authorities.push({
      title: org.betreibung,
      basis: "Art. 46 SchKG",
      detail: `Am Wohnsitz bzw. Sitz der Schuldnerin (${ctx.debtor?.name || ctx.debtor_party_id}).`
    });
    venues.push({
      title: "Rechtsöffnungsgericht",
      basis: "Art. 84 ff. SchKG",
      detail: "Nach Rechtsvorschlag; nicht über Justitia-Typen 5/6 in dieser Suite."
    });
    venues.push({
      title: org.first,
      basis: "Art. 85a / 83 SchKG",
      detail: "Aberkennung bzw. Rechtsöffnung vor dem zuständigen Gericht am Betreibungsort."
    });
    deadlines.push(
      deadline("schkg-rv", "Rechtsvorschlag", 10, "Art. 74 SchKG", start, "Ab Zustellung des Zahlungsbefehls.", "schkg")
    );
    deadlines.push(
      deadline(
        "schkg-ro",
        "Rechtsöffnung / Aberkennung",
        20,
        "Art. 83 / 85a SchKG",
        start,
        "Fristen je nach Pfad; Gericht setzt teilweise selbst.", "schkg")
    );
  }

  deadlines.push(
    deadline(
      "justitia-fiktion",
      "Justitia-Zustellfiktion",
      7,
      "Justitia.swiss (7-Tage-Fiktion bei DELIVERY)",
      start,
      "Abruf einer Zustellung bleibt in der Suite bewusst und nicht automatisch RECEIVED.", "fiction")
  );
  const calcBasis =
    family === "stpo" ? "Art. 90 StPO" : family === "admin" ? "Art. 20–22 VwVG" : family === "schkg" ? "Art. 31 SchKG" : "Art. 142 ZPO";
  const standstillBasis =
    family === "stpo"
      ? "Im Strafverfahren gibt es keine Gerichtsferien (Art. 89 Abs. 2 StPO)."
      : family === "schkg"
        ? "Betreibungsferien (Art. 56 Ziff. 2 SchKG: Ostern und Weihnachten je ±7 Tage, 15.–31. Juli) verlängern ein Fristende darin bis zum 3. Werktag danach (Art. 63 SchKG)."
        : family === "admin"
          ? "Stillstand nach Art. 22a VwVG / Art. 46 BGG (Ostern ±7 Tage, 15.07.–15.08., 18.12.–02.01.) ist eingerechnet."
          : "Stillstand nach Art. 145 ZPO (Ostern ±7 Tage, 15.07.–15.08., 18.12.–02.01.) ist eingerechnet, ausser im summarischen und im Schlichtungsverfahren.";

  if (holderCanton.canton && holderCanton.canton !== canton) {
    venues.push({
      title: `Sitz der Inhaberin ${holderCanton.canton}`,
      basis: "Aktenlage",
      detail: `Inhaberin ${ctx.holder?.name || ctx.current_holder_party_id} — ${holderCanton.source}. Nicht automatisch Gerichtsstand der Klage.`
    });
  }

  return {
    family,
    family_label: FAMILY_LABEL[family],
    inferred,
    canton,
    canton_source: source,
    streitwert: amount,
    procedure,
    venues,
    authorities,
    deadlines,
    disclaimer:
      `Hinweis aus Standardregeln von ZPO, StPO, VwVG/BGG und SchKG. Kein Rechtsrat. ${calcBasis}: Frist beginnt am Tag nach der Zustellung; letzter Tag auf Sa/So oder Feiertag verschiebt sich auf den nächsten Werktag. ${standstillBasis} Berücksichtigt sind nur landesweite Feiertage, keine kantonalen Feiertage am Gerichtsort. Kantonale VRPG und Gerichtsstandsvereinbarungen können abweichen.`
  };
}
