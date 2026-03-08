import type { CounterpartyExposure } from "@/lib/dashboard";
import { formatCurrency, formatNumber, severityToColor } from "@/lib/dashboard";
import { WidgetCard } from "./WidgetCard";

type CounterpartyExposureWidgetProps = {
  exposures: CounterpartyExposure[];
};

export function CounterpartyExposureWidget({ exposures }: CounterpartyExposureWidgetProps) {
  return (
    <WidgetCard title="Counterparty Exposure" subtitle="Konzentrationsrisiken nach Gegenpartei">
      {exposures.length === 0 ? (
        <p className="dashboard-empty">Keine Exposure-Daten verfügbar.</p>
      ) : (
        <div className="dashboard-list">
          {exposures.map((entry) => (
            <div key={entry.counterparty} className="dashboard-list-item">
              <div>
                <strong>{entry.counterparty}</strong>
                <p>{formatNumber(entry.instruments)} Instrumente</p>
              </div>
              <div className="dashboard-list-meta">
                <strong>{formatCurrency(entry.exposureVolume, entry.currency)}</strong>
                <span style={{ color: severityToColor(entry.riskLevel), fontWeight: 700 }}>{entry.riskLevel}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
