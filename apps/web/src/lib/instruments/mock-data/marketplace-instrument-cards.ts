import { getInstrumentTemplate, seededInstrumentExamples } from "../seed-templates";

export type InstrumentMarketplaceCard = {
  id: string;
  instrumentType: string;
  title: string;
  summary: string;
  visibility: string;
};

export const marketplaceInstrumentCards: InstrumentMarketplaceCard[] = seededInstrumentExamples.map((example) => {
  const template = getInstrumentTemplate(example.templateType);
  const titleField = template.marketplaceMeta.listingTitleField || template.documentRendering.titleFieldId;
  const titleValue = example.values[titleField];

  return {
    id: example.id,
    instrumentType: template.type,
    title: typeof titleValue === "string" ? titleValue : template.title,
    summary: template.marketplaceMeta.summaryFields
      .slice(0, 3)
      .map((fieldId) => `${fieldId}: ${String(example.values[fieldId] ?? "—")}`)
      .join(" | "),
    visibility: String(example.values.marktplatzsichtbarkeit ?? template.marketplaceMeta.defaultVisibility)
  };
});
