import { Card, SectionTitle } from "@sponsum/ui";
import { apiGet } from "@/lib/api";

type Escrow = {
  id: string;
  relatedClaimId: string;
  escrowAgent: string;
  amount: string;
  currency: string;
  status: string;
  releaseConditions: string;
};

export default async function EscrowPage() {
  const records = await apiGet<Escrow[]>("/escrow/arrangements").catch(() => []);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <Card>
        <SectionTitle title="Escrow" subtitle="Conditional release arrangements linked to claims." />
      </Card>
      {records.map((record) => (
        <Card key={record.id}>
          <strong>{record.escrowAgent}</strong>
          <p>{record.amount} {record.currency} · {record.status}</p>
          <p style={{ color: "#475569" }}>{record.releaseConditions}</p>
          <p style={{ fontSize: 13, color: "#64748b" }}>Claim: {record.relatedClaimId}</p>
        </Card>
      ))}
    </div>
  );
}
