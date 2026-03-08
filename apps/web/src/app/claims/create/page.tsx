import Link from "next/link";
import { CORE_TEMPLATES } from "@sponsum/shared";
import { Card, SectionTitle } from "@sponsum/ui";
import { CreateClaimForm } from "@/components/CreateClaimForm";

export default function CreateClaimPage({ searchParams }: { searchParams?: { template?: string } }) {
  const selectedTemplate = CORE_TEMPLATES.find((tpl) => tpl.id === searchParams?.template);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <Card>
        <SectionTitle
          title="Create Claim"
          subtitle="Template selection is part of the wizard. Choose a template first, then complete the draft form."
        />
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/claims/create/wizard/1"><button style={{ background: "#2563eb" }}>Open Template Wizard</button></Link>
          {selectedTemplate ? <Link href={`/claims/create/wizard/1?template=${selectedTemplate.id}`}><button>Change Template</button></Link> : null}
        </div>
        <p style={{ color: "#475569", marginTop: 12 }}>
          Selected template: {selectedTemplate?.title || "None selected yet. Start with the wizard."}
        </p>
      </Card>
      {selectedTemplate ? (
        <Card>
          <CreateClaimForm initialTemplateId={selectedTemplate.id} />
        </Card>
      ) : (
        <Card>
          <p style={{ color: "#475569", margin: 0 }}>
            Please choose a template in the wizard before creating a claim.
          </p>
        </Card>
      )}
    </div>
  );
}
