import Link from "next/link";
import { CORE_TEMPLATES } from "@sponsum/shared";
import { Card, SectionTitle } from "@sponsum/ui";

const wizardSteps = [
  "Choose template",
  "Define parties",
  "Define economic terms",
  "Define settlement rules",
  "Add collateral/guarantee/escrow/custody",
  "Define dispute mechanism",
  "Review human-readable summary",
  "Publish or save draft"
];

export default function WizardStepPage({
  params,
  searchParams
}: {
  params: { step: string };
  searchParams?: { template?: string };
}) {
  const stepNumber = Math.max(1, Math.min(8, Number(params.step || 1)));
  const title = wizardSteps[stepNumber - 1];
  const selectedTemplateId = searchParams?.template;
  const selectedTemplate = CORE_TEMPLATES.find((tpl) => tpl.id === selectedTemplateId);
  const query = selectedTemplateId ? `?template=${selectedTemplateId}` : "";
  const canGoNext = stepNumber < 8 && (stepNumber !== 1 || Boolean(selectedTemplateId));

  return (
    <div className="grid" style={{ gap: 16 }}>
      <Card>
        <SectionTitle title={`Wizard Step ${stepNumber}: ${title}`} subtitle="Plain-language guidance for non-lawyers." />
        <p style={{ color: "#475569" }}>
          In this MVP scaffold, each step captures data for the modular claim engine: legal structure, economic logic,
          payment logic, trust metadata, and enforcement settings.
        </p>
      </Card>

      <Card>
        {stepNumber === 1 ? (
          <div className="grid" style={{ gap: 12 }}>
            <p style={{ color: "#475569", margin: 0 }}>Select a template to continue to step 2.</p>
            <div className="grid grid-2">
              {CORE_TEMPLATES.map((tpl) => (
                <div key={tpl.id} style={{ border: "1px solid #d7dce4", borderRadius: 10, padding: 12 }}>
                  <strong>{tpl.title}</strong>
                  <p style={{ color: "#475569" }}>{tpl.description}</p>
                  <Link href={`/claims/create/wizard/2?template=${tpl.id}`}>
                    <button>Use Template</button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <p style={{ color: "#475569" }}>
              Active template: {selectedTemplate?.title || "No template selected. Go back to step 1."}
            </p>
            <p style={{ color: "#475569" }}>
              This step is currently a scaffold. Continue through the wizard and open the claim form with your template.
            </p>
          </>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          {stepNumber > 1 ? <Link href={`/claims/create/wizard/${stepNumber - 1}${query}`}><button>Previous</button></Link> : null}
          {canGoNext ? <Link href={`/claims/create/wizard/${stepNumber + 1}${query}`}><button>Next</button></Link> : null}
          <Link href={`/claims/create${query}`}><button style={{ background: "#2563eb" }}>Open Create Form</button></Link>
        </div>
      </Card>
    </div>
  );
}
