import Link from "next/link";
import { Badge, Card, SectionTitle } from "@sponsum/ui";
import { DisputeClaimsSection, DisputeLinkedInstrumentMap } from "@/components/disputes";
import { claimMocks, disputeMocks, getInstrumentContextById } from "@/lib/claims";
import { formatDateTime } from "@/lib/dashboard";
import { disputeStatusLabels, escalationLabels } from "@/lib/disputes";

export default function DisputesPage() {
  const openDisputes = disputeMocks.filter((entry) => entry.status !== "resolved");

  return (
    <div className="grid" style={{ gap: 16 }}>
      <Card>
        <SectionTitle
          title="Disputes"
          subtitle="Claims sind strukturiert mit Instrumentfeldern, Klauseln, Settlement-Ereignissen und Dokumentpflichten verknüpft."
        />
        <p style={{ margin: "8px 0 0", color: "#475569" }}>
          Offene Fälle: <strong>{openDisputes.length}</strong> · Gesamt-Claims: <strong>{claimMocks.length}</strong>
        </p>
      </Card>

      {disputeMocks.map((dispute) => {
        const context = getInstrumentContextById(dispute.instrumentId);

        return (
          <div key={dispute.id} className="grid" style={{ gap: 12 }}>
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ margin: "0 0 6px" }}>{dispute.title}</h3>
                  <p style={{ margin: 0, color: "#475569" }}>{dispute.summary}</p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <Badge label={disputeStatusLabels[dispute.status]} />
                  <Badge label={escalationLabels[dispute.escalationLevel]} />
                </div>
              </div>

              <div className="dashboard-list" style={{ marginTop: 12 }}>
                <div className="dashboard-list-item">
                  <div>
                    <strong>Instrument</strong>
                    <p>{dispute.instrumentTitle}</p>
                  </div>
                  <Link href={`/instruments/${context?.template.type || "wechsel"}`}>
                    <span className="dashboard-widget-link">Instrument öffnen</span>
                  </Link>
                </div>

                <div className="dashboard-list-item">
                  <div>
                    <strong>Parteien</strong>
                    <p>
                      Claimant: {dispute.claimant} · Respondent: {dispute.respondent}
                    </p>
                  </div>
                  <div className="dashboard-list-meta">
                    <span>Owner: {dispute.owner}</span>
                    <span>Antwortfrist: {formatDateTime(dispute.responseDueAt)}</span>
                  </div>
                </div>
              </div>
            </Card>

            <DisputeLinkedInstrumentMap dispute={dispute} context={context} />
            <DisputeClaimsSection dispute={dispute} context={context} />
          </div>
        );
      })}
    </div>
  );
}
