import type { QuickAction } from "@/lib/dashboard";
import { severityToColor } from "@/lib/dashboard";
import { WidgetCard } from "./WidgetCard";

type QuickActionsPanelProps = {
  actions: QuickAction[];
};

export function QuickActionsPanel({ actions }: QuickActionsPanelProps) {
  return (
    <WidgetCard title="Quick Actions" subtitle="Direkte operative Aktionen für den Tagesbetrieb.">
      {actions.length === 0 ? (
        <p className="dashboard-empty">Keine Quick Actions für den aktuellen Filter.</p>
      ) : (
        <div className="dashboard-list">
          {actions.map((action) => (
            <a key={action.id} href={action.href} className="dashboard-action-item">
              <div>
                <strong>{action.label}</strong>
                <p>{action.description}</p>
              </div>
              {action.severity ? (
                <span style={{ color: severityToColor(action.severity), fontWeight: 600 }}>{action.severity}</span>
              ) : null}
            </a>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
