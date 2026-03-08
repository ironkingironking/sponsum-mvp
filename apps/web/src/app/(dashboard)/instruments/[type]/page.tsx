import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, SectionTitle } from "@sponsum/ui";
import { InstrumentTemplateRenderer } from "@/components/instruments";
import { getInstrumentTemplate, isInstrumentType, seededInstrumentExamples } from "@/lib/instruments";

type InstrumentTypePageProps = {
  params: {
    type: string;
  };
};

export default function InstrumentTypePage({ params }: InstrumentTypePageProps) {
  if (!isInstrumentType(params.type)) {
    notFound();
  }

  const template = getInstrumentTemplate(params.type);
  const seed = seededInstrumentExamples.find((entry) => entry.templateType === params.type);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <Card>
        <SectionTitle title={template.title} subtitle={template.subtitle} />
        <p style={{ color: "#475569", marginTop: 0 }}>{template.historicalContext}</p>
        <p style={{ color: "#475569", marginBottom: 0 }}>{template.legalIntent}</p>
        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/instruments">
            <button type="button">Zur Instrument-Übersicht</button>
          </Link>
          <Link href={`/instruments/new?type=${template.type}`}>
            <button type="button">Neues Draft aus diesem Template</button>
          </Link>
        </div>
      </Card>

      <InstrumentTemplateRenderer
        template={template}
        initialValues={seed?.values}
        initialSelectedClauseIds={seed?.selectedClauseIds}
        initialClauseOverrides={seed?.clauseOverrides}
        defaultAudience="internal"
      />
    </div>
  );
}
