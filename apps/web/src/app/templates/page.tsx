import Link from "next/link";
import { CORE_TEMPLATES } from "@sponsum/shared";
import { Card, SectionTitle } from "@sponsum/ui";

export default function TemplatesPage() {
  return (
    <div className="container grid" style={{ gap: 16 }}>
      <Card>
        <SectionTitle title="Claim Types" subtitle="Pick a template and continue in the simple claim wizard." />
      </Card>
      <div className="grid grid-2">
        {CORE_TEMPLATES.map((tpl) => (
          <Card key={tpl.id}>
            <strong>{tpl.title}</strong>
            <p style={{ color: "#475569" }}>{tpl.description}</p>
            <p style={{ fontSize: 13, color: "#64748b" }}>Roles: {tpl.requiredRoles.join(", ")}</p>
            <Link href="/claims/create">
              <button style={{ marginTop: 8 }}>Use template</button>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
