import Link from "next/link";
import { Card, SectionTitle } from "@sponsum/ui";
import { InstrumentTemplateRenderer } from "@/components/instruments";
import { getInstrumentTemplate, instrumentTypes, isInstrumentType } from "@/lib/instruments";

type InstrumentNewPageProps = {
  searchParams: {
    type?: string | string[];
  };
};

export default function InstrumentNewPage({ searchParams }: InstrumentNewPageProps) {
  const requestedType = Array.isArray(searchParams.type) ? searchParams.type[0] : searchParams.type;
  const selectedType = requestedType && isInstrumentType(requestedType) ? requestedType : "wechsel";
  const template = getInstrumentTemplate(selectedType);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <Card>
        <SectionTitle title="Neues Instrument" subtitle="Template wählen, Felder befüllen und Validierung prüfen." />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {instrumentTypes.map((type) => (
            <Link key={type} href={`/instruments/new?type=${type}`}>
              <button type="button" style={{ background: type === selectedType ? "#0f172a" : "#334155" }}>
                {type}
              </button>
            </Link>
          ))}
        </div>
      </Card>

      <InstrumentTemplateRenderer template={template} defaultAudience="internal" />
    </div>
  );
}
