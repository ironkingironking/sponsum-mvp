import type { MarketplacePerformance } from "@/lib/dashboard";
import { formatNumber, formatPercent } from "@/lib/dashboard";
import { WidgetCard } from "./WidgetCard";

type MarketplacePerformanceWidgetProps = {
  metrics: MarketplacePerformance;
};

export function MarketplacePerformanceWidget({ metrics }: MarketplacePerformanceWidgetProps) {
  return (
    <WidgetCard title="Marketplace Performance" subtitle="Angebote, Nachfrage und Preisindikatoren">
      <div className="marketplace-kpi-grid">
        <div>
          <p>Publizierte Angebote</p>
          <strong>{formatNumber(metrics.publishedOffers)}</strong>
        </div>
        <div>
          <p>Views</p>
          <strong>{formatNumber(metrics.totalViews)}</strong>
        </div>
        <div>
          <p>Watchlist</p>
          <strong>{formatNumber(metrics.watchlistAdds)}</strong>
        </div>
        <div>
          <p>Conversion</p>
          <strong>{formatPercent(metrics.contactConversionRate)}</strong>
        </div>
        <div>
          <p>Avg. Diskont</p>
          <strong>{formatPercent(metrics.avgDiscountPercent)}</strong>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <strong>Nachfrage nach Instrumenttyp</strong>
        {metrics.demandByType.length === 0 ? (
          <p className="dashboard-empty">Keine Nachfrage-Daten vorhanden.</p>
        ) : (
          <div className="dashboard-list">
            {metrics.demandByType.map((entry) => (
              <div key={entry.type} className="dashboard-list-item">
                <span>{entry.type}</span>
                <strong>{formatNumber(entry.demandScore)}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </WidgetCard>
  );
}
