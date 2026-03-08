export type TemplateGroup = {
  id: string;
  label: string;
  description: string;
  sortOrder: number;
  defaultExpanded?: boolean;
};

export const baseTemplateGroups: TemplateGroup[] = [
  {
    id: "basisdaten",
    label: "Basisdaten",
    description: "Dokumenttitel, Instrumenttyp und Kernmetadaten.",
    sortOrder: 10,
    defaultExpanded: true
  },
  {
    id: "parteien",
    label: "Parteien & Rollen",
    description: "Aussteller, Schuldner, Begünstigte und weitere Rollen.",
    sortOrder: 20,
    defaultExpanded: true
  },
  {
    id: "oekonomik",
    label: "Ökonomische Konditionen",
    description: "Beträge, Währungen, Zinssätze und Verteilungslogik.",
    sortOrder: 30,
    defaultExpanded: true
  },
  {
    id: "fristen",
    label: "Fristen & Bedingungen",
    description: "Verfall, Trigger, Laufzeiten und Fälligkeiten.",
    sortOrder: 40
  },
  {
    id: "sicherheiten",
    label: "Sicherheiten & Haftung",
    description: "Collateral, Avale, Haftungsgrenzen und Regressrechte.",
    sortOrder: 50
  },
  {
    id: "historisch",
    label: "Historische Zusatzparameter",
    description: "Historisch inspirierte Formeln und Dokumenthinweise.",
    sortOrder: 60
  },
  {
    id: "klauseln",
    label: "Klauseln",
    description: "Rechtswahl, Gerichtsstand, EoD und Sonderklauseln.",
    sortOrder: 70
  },
  {
    id: "settlement",
    label: "Settlement & Erfüllung",
    description: "Erfüllungslogik, Trigger und Abwicklungsereignisse.",
    sortOrder: 80
  },
  {
    id: "dispute",
    label: "Dispute & Rechtsdurchsetzung",
    description: "Konfliktpfad, Beweisanforderungen und Eskalation.",
    sortOrder: 90
  },
  {
    id: "dokumente",
    label: "Dokumente & Nachweise",
    description: "Urkundenelemente, Uploads und Nachweisfelder.",
    sortOrder: 100
  },
  {
    id: "marketplace",
    label: "Marketplace & interne Metadaten",
    description: "Sichtbarkeit, NDA-Schutz und Plattformsteuerung.",
    sortOrder: 110
  }
];
