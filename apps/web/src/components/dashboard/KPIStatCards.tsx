import type { KPIStat } from "@/lib/dashboard";
import { severityToColor, trendToSymbol } from "@/lib/dashboard";

type KPIStatCardsProps = {
  items: KPIStat[];
};

export function KPIStatCards({ items }: KPIStatCardsProps) {
  return (
    <div className="kpi-grid">
      {items.map((item) => (
        <a key={item.id} href={item.href} className="kpi-card">
          <p className="kpi-label">{item.label}</p>
          <p className="kpi-value">{item.value}</p>
          <p className="kpi-description">{item.description}</p>
          <div className="kpi-meta-row">
            {item.trend ? (
              <span className="kpi-trend">
                {trendToSymbol(item.trend.direction)} {item.trend.value}
              </span>
            ) : (
              <span />
            )}
            {item.severity ? (
              <span className="kpi-severity" style={{ color: severityToColor(item.severity) }}>
                {item.severity}
              </span>
            ) : null}
          </div>
        </a>
      ))}
    </div>
  );
}
