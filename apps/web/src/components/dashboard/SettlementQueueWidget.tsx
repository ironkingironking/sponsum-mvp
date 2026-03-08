import type { SettlementQueueItem } from "@/lib/dashboard";
import { formatCurrency, formatDate, formatRelativeDays } from "@/lib/dashboard";
import { WidgetCard } from "./WidgetCard";

type SettlementQueueWidgetProps = {
  items: SettlementQueueItem[];
};

export function SettlementQueueWidget({ items }: SettlementQueueWidgetProps) {
  return (
    <WidgetCard title="Settlement Queue" subtitle="Pending, partial und bestaetigte Settlements">
      {items.length === 0 ? (
        <p className="dashboard-empty">Keine Settlement-Eintraege vorhanden.</p>
      ) : (
        <div className="dashboard-table-wrap">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Instrument</th>
                <th>Methode</th>
                <th>Faellig</th>
                <th>Betrag</th>
                <th>Status</th>
                <th>Evidence</th>
                <th>Naechste Aktion</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.instrumentTitle}</td>
                  <td>{item.method}</td>
                  <td>
                    {formatDate(item.dueDate)}
                    <br />
                    <span className="dashboard-muted">{formatRelativeDays(item.dueDate)}</span>
                  </td>
                  <td>{formatCurrency(item.amount, item.currency)}</td>
                  <td>{item.status}</td>
                  <td>{item.paymentEvidenceUploaded ? "ok" : "missing"}</td>
                  <td>{item.nextAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </WidgetCard>
  );
}
