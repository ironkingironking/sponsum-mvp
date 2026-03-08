import type { ClaimDashboardInsights } from "@/lib/dashboard";
import { WidgetCard } from "./WidgetCard";

type ClaimInsightsWidgetProps = {
  insights: ClaimDashboardInsights;
};

function labelForTargetType(targetType: string): string {
  const labels: Record<string, string> = {
    template_field: "Template-Felder",
    clause_block: "Klauselblöcke",
    settlement_event: "Settlement-Events",
    document_requirement: "Dokumentenpflichten",
    uploaded_document: "Dokumente",
    obligation: "Obligationen",
    payment_schedule_entry: "Zahlungsplan-Einträge",
    instrument_party: "Parteien",
    custom: "Custom"
  };

  return labels[targetType] || targetType;
}

export function ClaimInsightsWidget({ insights }: ClaimInsightsWidgetProps) {
  return (
    <WidgetCard
      title="Claim Insights"
      subtitle="Offene Claims nach Zieltyp, Dokumentenbezug und häufig bestrittenen Referenzen."
      actionHref="/disputes"
      actionLabel="Zu Disputes"
    >
      {insights.openCount === 0 ? (
        <p className="dashboard-empty">Keine offenen Claims im gewählten Filter.</p>
      ) : (
        <div className="dashboard-list">
          <div className="dashboard-list-item">
            <div>
              <strong>Offene Claims</strong>
              <p>{insights.openCount}</p>
            </div>
          </div>

          <div className="dashboard-list-item">
            <div>
              <strong>Nach Zieltyp</strong>
              <p>
                {insights.byTargetType.map((entry) => `${labelForTargetType(entry.targetType)}: ${entry.count}`).join(" · ")}
              </p>
            </div>
          </div>

          <div className="dashboard-list-item">
            <div>
              <strong>Settlement-bezogene Claims</strong>
              <p>{insights.overdueSettlementLinked}</p>
            </div>
          </div>

          <div className="dashboard-list-item">
            <div>
              <strong>Dokumentenbezogene Claims</strong>
              <p>{insights.documentComplianceLinked}</p>
            </div>
          </div>

          <div className="dashboard-list-item">
            <div>
              <strong>Häufig bestrittene Klauseln</strong>
              <p>
                {insights.contestedClauses.length
                  ? insights.contestedClauses.map((entry) => `${entry.clauseBlockId} (${entry.count})`).join(", ")
                  : "Keine"}
              </p>
            </div>
          </div>

          <div className="dashboard-list-item">
            <div>
              <strong>Häufig betroffene Template-Felder</strong>
              <p>
                {insights.disputedFields.length
                  ? insights.disputedFields.map((entry) => `${entry.templateFieldId} (${entry.count})`).join(", ")
                  : "Keine"}
              </p>
            </div>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
