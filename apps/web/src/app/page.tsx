import Link from "next/link";
import { CORE_TEMPLATES } from "@sponsum/shared";
import { Card, SectionTitle } from "@sponsum/ui";

export default function LandingPage() {
  return (
    <div className="grid" style={{ gap: 20 }}>
      <Card>
        <SectionTitle
          title="Sponsum: marketplace for claims and obligations"
          subtitle="Modern and historical instruments in one modular engine, understandable for non-lawyers."
        />
        <p style={{ color: "#475569" }}>
          Create, transfer, trade and settle invoice claims, bills of exchange, promissory notes, commenda-style venture
          contracts, annuity/Gült structures, guaranteed obligations and custom private-law financing.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <Link href="/marketplace"><button>Browse Marketplace</button></Link>
          <Link href="/claims/create"><button style={{ background: "#2563eb" }}>Create Claim</button></Link>
        </div>
      </Card>

      <Card>
        <SectionTitle title="7 Core Templates" subtitle="Simple mode and advanced mode are built on the same engine." />
        <div className="grid grid-2">
          {CORE_TEMPLATES.map((tpl) => (
            <div key={tpl.id} style={{ border: "1px solid #d7dce4", borderRadius: 10, padding: 12 }}>
              <strong>{tpl.title}</strong>
              <p style={{ color: "#475569", marginTop: 6 }}>{tpl.description}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
