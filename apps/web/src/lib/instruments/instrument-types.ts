export const instrumentTypes = [
  "wechsel",
  "solawechsel",
  "schuldschein",
  "guelt",
  "commenda",
  "zession",
  "garantie",
  "vorschuss"
] as const;

export type InstrumentType = (typeof instrumentTypes)[number];

export const instrumentTypeLabels: Record<InstrumentType, string> = {
  wechsel: "Wechsel",
  solawechsel: "Solawechsel / Eigenwechsel",
  schuldschein: "Schuldschein / Darlehensschein",
  guelt: "Gült / Rentenbriefartige Struktur",
  commenda: "Commenda / Beteiligungsvertrag",
  zession: "Zession / Forderungsabtretung",
  garantie: "Bürgschaft / Aval / Garantie",
  vorschuss: "Vorschuss auf künftige Forderungen"
};

export function isInstrumentType(value: string): value is InstrumentType {
  return instrumentTypes.includes(value as InstrumentType);
}
