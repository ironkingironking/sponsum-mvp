import { Badge, Card, SectionTitle } from "@sponsum/ui";
import { apiGet } from "@/lib/api";

type ClaimDetail = {
  id: string;
  title: string;
  instrumentType: string;
  amount: string;
  currency: string;
  issueDate: string;
  maturityDate: string;
  settlementModel: string;
  transferability: string;
  disputeConfig: string;
  governingLaw: string;
  jurisdiction: string;
  humanSummary: string;
  status: string;
  parties: Array<{ id: string; role: string; displayName: string }>;
  settlementEvents: Array<{ id: string; type: string; status: string; amountDue: string | null; amountPaid: string | null }>;
  disputes: Array<{ id: string; disputeType: string; status: string; disputeReason: string }>;
  collateralRecords: Array<{ id: string; collateralType: string; status: string; valuation: string }>;
  escrowArrangements: Array<{ id: string; status: string; amount: string; releaseConditions: string }>;
  custodyRecords: Array<{ id: string; custodyType: string; custodyStatus: string }>;
  eventLogs: Array<{ id: string; eventType: string; createdAt: string }>;
};

export default async function ClaimDetailPage({ params }: { params: { id: string } }) {
  const claim = await apiGet<ClaimDetail>(`/claims/${params.id}`);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <Card>
        <SectionTitle title={claim.title} subtitle={claim.humanSummary} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge label={claim.instrumentType} />
          <Badge label={claim.status} />
          <Badge label={claim.settlementModel} />
        </div>
        <p style={{ marginTop: 12 }}>
          {claim.amount} {claim.currency} · Due {new Date(claim.maturityDate).toLocaleDateString()}
        </p>
        <p style={{ color: "#475569" }}>
          Governing law: {claim.governingLaw} · Jurisdiction: {claim.jurisdiction}
        </p>
      </Card>

      <Card>
        <SectionTitle title="Who owes what" />
        {claim.parties.map((party) => (
          <p key={party.id}>
            <strong>{party.role}</strong>: {party.displayName}
          </p>
        ))}
      </Card>

      <div className="grid grid-2">
        <Card>
          <SectionTitle title="Settlement timeline" />
          {claim.settlementEvents.map((event) => (
            <p key={event.id}>
              {event.type} · {event.status} · due {event.amountDue ?? "-"} · paid {event.amountPaid ?? "-"}
            </p>
          ))}
        </Card>

        <Card>
          <SectionTitle title="Disputes" />
          {claim.disputes.length === 0 ? <p>No disputes</p> : null}
          {claim.disputes.map((dispute) => (
            <p key={dispute.id}>
              {dispute.disputeType} · {dispute.status} · {dispute.disputeReason}
            </p>
          ))}
        </Card>

        <Card>
          <SectionTitle title="Collateral" />
          {claim.collateralRecords.map((record) => (
            <p key={record.id}>
              {record.collateralType} · {record.status} · valuation {record.valuation}
            </p>
          ))}
        </Card>

        <Card>
          <SectionTitle title="Escrow & Custody" />
          {claim.escrowArrangements.map((escrow) => (
            <p key={escrow.id}>
              Escrow: {escrow.status} · {escrow.amount} · {escrow.releaseConditions}
            </p>
          ))}
          {claim.custodyRecords.map((custody) => (
            <p key={custody.id}>
              Custody: {custody.custodyType} · {custody.custodyStatus}
            </p>
          ))}
        </Card>
      </div>

      <Card>
        <SectionTitle title="Event log" />
        {claim.eventLogs.map((event) => (
          <p key={event.id}>
            {new Date(event.createdAt).toLocaleString()} · {event.eventType}
          </p>
        ))}
      </Card>
    </div>
  );
}
