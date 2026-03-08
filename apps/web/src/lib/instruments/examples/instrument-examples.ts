import type { InstrumentType } from "../instrument-types";
import type { InstrumentDraft } from "../template-base";
import { seededInstrumentExamples } from "../seed-templates";

export const instrumentExamplesByType: Partial<Record<InstrumentType, InstrumentDraft>> = Object.fromEntries(
  seededInstrumentExamples.map((example) => [example.templateType, example])
) as Partial<Record<InstrumentType, InstrumentDraft>>;

export function getSeedExampleByType(type: InstrumentType): InstrumentDraft | undefined {
  return instrumentExamplesByType[type];
}
