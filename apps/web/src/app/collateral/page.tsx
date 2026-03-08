import { Card, SectionTitle } from "@sponsum/ui";
import { apiGet } from "@/lib/api";

type Collateral = {
  id: string;
  relatedClaimId: string;
  collateralType: string;
  owner: string;
  beneficiary: string;
  valuation: string;
  status: string;
};

export default async function CollateralPage() {
  const records = await apiGet<Collateral[]>("/collateral/records").catch(() => []);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <Card>
        <SectionTitle title="Collateral Registry" subtitle="Registered collateral linked to marketplace claims." />
      </Card>
      {records.map((record) => (
        <Card key={record.id}>
          <strong>{record.collateralType}</strong>
          <p style={{ color: "#475569" }}>
            Owner: {record.owner} · Beneficiary: {record.beneficiary}
          </p>
          <p>
            Valuation: {record.valuation} · Status: {record.status}
          </p>
          <p style={{ fontSize: 13, color: "#64748b" }}>Claim: {record.relatedClaimId}</p>
        </Card>
      ))}
    </div>
  );
}
