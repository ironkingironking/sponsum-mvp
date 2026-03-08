import type { RiskAlert } from "@/lib/dashboard";
import { formatDate, severityToColor } from "@/lib/dashboard";
import { WidgetCard } from "./WidgetCard";

type RiskAlertsWidgetProps = {
  alerts: RiskAlert[];
};

export function RiskAlertsWidget({ alerts }: RiskAlertsWidgetProps) {
  return (
    <WidgetCard title="Risk & Compliance Alerts" subtitle="Dokument-, Counterparty-, Settlement- und Konzentrationsrisiken">
      {alerts.length === 0 ? (
        <p className="dashboard-empty">Keine aktiven Risiko-Alerts.</p>
      ) : (
        <div className="dashboard-list">
          {alerts.map((alert) => (
            <div key={alert.id} className="dashboard-list-item">
              <div>
                <strong>{alert.title}</strong>
                <p>{alert.description}</p>
                {alert.instrumentTitle ? <p>{alert.instrumentTitle}</p> : null}
              </div>
              <div className="dashboard-list-meta">
                <span style={{ color: severityToColor(alert.severity), fontWeight: 700 }}>{alert.severity}</span>
                {alert.dueAt ? <span>{formatDate(alert.dueAt)}</span> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
