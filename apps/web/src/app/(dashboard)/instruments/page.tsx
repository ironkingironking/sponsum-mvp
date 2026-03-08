import Link from "next/link";
import { Card, SectionTitle } from "@sponsum/ui";
import { TemplatePreviewCard } from "@/components/instruments";
import { instrumentTemplates, seededInstrumentExamples } from "@/lib/instruments";

export default function InstrumentsPage() {
  return (
    <div className="grid" style={{ gap: 16 }}>
      <Card>
        <SectionTitle
          title="Instrumente"
          subtitle="Schema-getriebene, historisch inspirierte Instrument-Templates mit Expert-/Historik-Modus."
        />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/instruments/new">
            <button>Neues Instrument aufsetzen</button>
          </Link>
          <Link href="/marketplace">
            <button type="button">Marketplace öffnen</button>
          </Link>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Template-Katalog" subtitle="Alle unterstützten Instrumente in Version 1.0.0." />
        <div className="grid grid-2">
          {instrumentTemplates.map((template) => (
            <TemplatePreviewCard key={template.type} template={template} href={`/instruments/${template.type}`} />
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Seed-Daten" subtitle="Realistische Beispielinstrumente für Demo, Marketplace-Preview und Tests." />
        <div className="grid grid-2">
          {seededInstrumentExamples.map((example) => {
            const template = instrumentTemplates.find((entry) => entry.type === example.templateType);
            if (!template) {
              return null;
            }
            return (
              <TemplatePreviewCard
                key={example.id}
                template={template}
                values={example.values}
                href={`/instruments/${example.templateType}`}
                badge="Seed"
              />
            );
          })}
        </div>
      </Card>
    </div>
  );
}
