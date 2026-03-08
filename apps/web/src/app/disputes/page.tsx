import Link from "next/link";
import { Badge, Card, SectionTitle } from "@sponsum/ui";
import { apiGet } from "@/lib/api";

type Dispute = {
  id: string;
  disputeType: string;
  status: string;
  disputeReason: string;
  claim: { id: string; title: string };
};

export default async function DisputesPage() {
  const disputes = await apiGet<Dispute[]>("/disputes").catch(() => []);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <Card>
        <SectionTitle title="Disputes" subtitle="Track non-payment, transfer, collateral, and contract disputes." />
      </Card>
      {disputes.map((item) => (
        <Card key={item.id}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>{item.disputeType}</strong>
            <Badge label={item.status} />
          </div>
          <p style={{ color: "#475569" }}>{item.disputeReason}</p>
          <Link href={`/claims/${item.claim.id}`}>Open related claim: {item.claim.title}</Link>
        </Card>
      ))}
    </div>
  );
}
