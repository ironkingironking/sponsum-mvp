import type { InstrumentType } from "./instrument-types";
import type { InstrumentDraft, TemplateDefinition } from "./template-base";
import { makeDraftFromTemplate } from "./template-base";
import { commendaTemplate } from "./templates/commenda.template";
import { garantieTemplate } from "./templates/garantie.template";
import { gueltTemplate } from "./templates/guelt.template";
import { schuldscheinTemplate } from "./templates/schuldschein.template";
import { solawechselTemplate } from "./templates/solawechsel.template";
import { vorschussTemplate } from "./templates/vorschuss.template";
import { wechselTemplate } from "./templates/wechsel.template";
import { zessionTemplate } from "./templates/zession.template";

export const instrumentTemplates: TemplateDefinition[] = [
  wechselTemplate,
  solawechselTemplate,
  schuldscheinTemplate,
  gueltTemplate,
  commendaTemplate,
  zessionTemplate,
  garantieTemplate,
  vorschussTemplate
];

export const instrumentTemplatesByType: Record<InstrumentType, TemplateDefinition> = {
  wechsel: wechselTemplate,
  solawechsel: solawechselTemplate,
  schuldschein: schuldscheinTemplate,
  guelt: gueltTemplate,
  commenda: commendaTemplate,
  zession: zessionTemplate,
  garantie: garantieTemplate,
  vorschuss: vorschussTemplate
};

export function getInstrumentTemplate(type: InstrumentType): TemplateDefinition {
  return instrumentTemplatesByType[type];
}

function withValues(template: TemplateDefinition, values: Record<string, unknown>): InstrumentDraft {
  const draft = makeDraftFromTemplate(template);
  return {
    ...draft,
    values: {
      ...draft.values,
      ...values
    }
  };
}

export const seededInstrumentExamples: InstrumentDraft[] = [
  withValues(wechselTemplate, {
    dokumententitel: "Wechsel Nr. 2026-114",
    wechselart: "handelswechsel",
    aussteller: "Helvetic Trading AG",
    bezogener: "Alpine Steel GmbH",
    remittent: "Rhine Factoring SA",
    ausstellungsort: "Zürich",
    ausstellungsdatum: "2026-03-01",
    verfalltag: "2026-09-01",
    waehrung: "CHF",
    betragNumerisch: 125000,
    betragAusgeschrieben: "Einhundertfünfundzwanzigtausend Schweizer Franken",
    avalVorhanden: true,
    avalist: "Cantonal Guarantee Office",
    rechtswahl: "CH-OR",
    gerichtsstand: "Zürich"
  }),
  withValues(schuldscheinTemplate, {
    dokumententitel: "Schuldschein Maschinenfinanzierung",
    schuldner: "Keller Maschinenbau GmbH",
    glaeubiger: "Sponsum Debt Partners",
    schuldgrund: "Finanzierung von Produktionsanlagen",
    kapitalbetrag: 480000,
    waehrung: "EUR",
    valutierungsdatum: "2026-04-15",
    zinssatz: 6.8,
    zinsmodell: "fixed",
    zinsperiode: "quarterly",
    tilgungsmodus: "linear",
    endfaelligkeit: "2030-04-15",
    verzugszins: 10.5,
    rechtswahl: "DE",
    gerichtsstand: "München"
  }),
  withValues(gueltTemplate, {
    dokumententitel: "Gültvertrag Bern-Land Nr. 88",
    rentenglaeubiger: "Bern Capital Cooperative",
    verpflichteter: "Estate Holder Bern Süd",
    belastetesObjekt: "Parzelle BE-778-11",
    objektbeschreibung: "Landwirtschaftliche Nutzfläche mit Nebengebäude",
    kapitalbetrag: 900000,
    rentenart: "fixed",
    rentenhoehe: 36000,
    zahlungstermine: "vierteljährlich jeweils zum Quartalsende",
    abloesbarkeit: true,
    abloesesumme: 940000,
    rangstelle: "Rang 1",
    rechtswahl: "CH",
    gerichtsstand: "Bern"
  }),
  withValues(commendaTemplate, {
    dokumententitel: "Commenda Spice Route 2026",
    kapitalgeber: "Ines Investor",
    operativerPartner: "Olaf Operator",
    zweck: "Handelsfinanzierung Gewürzroute",
    projektbeschreibung: "Vorfinanzierung von Lager, Transport und Absatz in drei Häfen.",
    einlage: 800000,
    waehrung: "USD",
    gewinnverteilung: "70/30 zugunsten Kapitalgeber bis Kapitalrückfluss, danach 55/45",
    verlusttragung: "Kapitalgeber trägt Vermögensverlust bis Einlage; Operator haftet bei grober Pflichtverletzung",
    reportingpflichten: "monatlich",
    exitRegeln: "ordentlicher Exit nach 24 Monaten oder bei EoD",
    rechtswahl: "EN",
    gerichtsstand: "London"
  }),
  withValues(zessionTemplate, {
    dokumententitel: "Zession Forderungspool Q3",
    zedent: "NordInvoice AG",
    zessionar: "Sponsum Receivable Fund",
    drittschuldner: "Retail Group Central",
    grundgeschaeft: "Lieferforderungen aus Rahmenvertrag 2025-09",
    abtretungsdatum: "2026-07-01",
    nominalwert: 350000,
    kaufpreis: 332000,
    diskont: 5.14,
    offeneOderStilleZession: "offen",
    benachrichtigungDrittschuldner: "Benachrichtigung innerhalb von 2 Banktagen",
    ursprungsfaelligkeit: "2026-09-30",
    inkassoDurch: "zessionar",
    rechtswahl: "CH",
    gerichtsstand: "Basel"
  })
];
