import type { DisputeQueueItem } from "@/lib/dashboard";
import { formatCurrency, formatDate, formatRelativeDays } from "@/lib/dashboard";
import { WidgetCard } from "./WidgetCard";

type DisputeQueueWidgetProps = {
  items: DisputeQueueItem[];
};

export function DisputeQueueWidget({ items }: DisputeQueueWidgetProps) {
  return (
    <WidgetCard title="Dispute Queue" subtitle="Offene Streitfaelle inklusive Reaktionsfrist und Eskalation">
      {items.length === 0 ? (
        <p className="dashboard-empty">Keine offenen Disputes.</p>
      ) : (
        <div className="dashboard-table-wrap">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Instrument</th>
                <th>Status</th>
                <th>Eskalation</th>
                <th>Antwortfrist</th>
                <th>Streitwert</th>
                <th>Dokumentenlage</th>
                <th>Gegenpartei</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.instrumentTitle}</td>
                  <td>{item.status}</td>
                  <td>{item.escalationStage}</td>
                  <td>
                    {formatDate(item.responseDueAt)}
                    <br />
                    <span className="dashboard-muted">{formatRelativeDays(item.responseDueAt)}</span>
                  </td>
                  <td>{formatCurrency(item.amountInDispute, item.currency)}</td>
                  <td>{item.documentationStatus}</td>
                  <td>{item.counterparty}</td>
                  <td>{item.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {items.length > 0 ? (
        <div style={{ marginTop: 10 }}>
          <a href="/disputes" className="dashboard-widget-link">
            Zur Dispute-Detailansicht
          </a>
        </div>
      ) : null}
    </WidgetCard>
  );
}
