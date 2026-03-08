import { Card, SectionTitle } from "@sponsum/ui";
import { apiGet } from "@/lib/api";

type Custody = {
  id: string;
  relatedClaimId: string;
  custodian: string;
  custodyType: string;
  custodyStatus: string;
  documentHash: string;
};

export default async function CustodyPage() {
  const records = await apiGet<Custody[]>("/custody/records").catch(() => []);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <Card>
        <SectionTitle title="Custody" subtitle="Controlled holding of instruments and evidence." />
      </Card>
      {records.map((record) => (
        <Card key={record.id}>
          <strong>{record.custodyType}</strong>
          <p>{record.custodian} · {record.custodyStatus}</p>
          <p style={{ color: "#475569" }}>Document hash: {record.documentHash}</p>
          <p style={{ fontSize: 13, color: "#64748b" }}>Claim: {record.relatedClaimId}</p>
        </Card>
      ))}
    </div>
  );
}
