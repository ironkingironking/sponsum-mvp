import type { DashboardInstrument } from "@/lib/dashboard";
import { formatCurrency, formatDate, formatDateTime, severityToColor } from "@/lib/dashboard";
import { WidgetCard } from "./WidgetCard";

type RecentInstrumentsTableProps = {
  instruments: DashboardInstrument[];
};

export function RecentInstrumentsTable({ instruments }: RecentInstrumentsTableProps) {
  return (
    <WidgetCard title="Recent Instruments" subtitle="Kompakte Uebersicht der letzten Instrument-Aktivitaeten">
      {instruments.length === 0 ? (
        <p className="dashboard-empty">Keine Instrumente fuer den aktuellen Filter.</p>
      ) : (
        <div className="dashboard-table-wrap">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Titel</th>
                <th>Typ</th>
                <th>Gegenpartei</th>
                <th>Nominalwert</th>
                <th>Faelligkeit</th>
                <th>Status</th>
                <th>Risiko</th>
                <th>Letzte Aktivitaet</th>
              </tr>
            </thead>
            <tbody>
              {instruments.map((instrument) => (
                <tr key={instrument.id}>
                  <td>{instrument.title}</td>
                  <td>{instrument.type}</td>
                  <td>{instrument.counterparty}</td>
                  <td>{formatCurrency(instrument.nominalVolume, instrument.currency)}</td>
                  <td>{formatDate(instrument.maturityDate)}</td>
                  <td>{instrument.status}</td>
                  <td style={{ color: severityToColor(instrument.riskLevel), fontWeight: 700 }}>
                    {instrument.riskLevel} ({instrument.riskScore})
                  </td>
                  <td>{formatDateTime(instrument.lastActivityAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </WidgetCard>
  );
}
