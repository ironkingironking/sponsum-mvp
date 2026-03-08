import type { ActivityFeedItem } from "@/lib/dashboard";
import { formatDateTime, severityToColor } from "@/lib/dashboard";
import { WidgetCard } from "./WidgetCard";

type ActivityFeedProps = {
  items: ActivityFeedItem[];
};

function actionLabel(action: ActivityFeedItem["action"]): string {
  const labels: Record<ActivityFeedItem["action"], string> = {
    instrument_created: "Instrument erstellt",
    listing_published: "Angebot publiziert",
    document_uploaded: "Dokument hochgeladen",
    counterparty_validated: "Gegenpartei validiert",
    settlement_confirmed: "Settlement bestätigt",
    dispute_opened: "Dispute eröffnet",
    clause_updated: "Klausel geändert"
  };
  return labels[action];
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  return (
      <WidgetCard title="Activity Feed" subtitle="Letzte operativen Ereignisse" actionHref="/dashboard?tab=admin" actionLabel="Alle Events">
      {items.length === 0 ? (
        <p className="dashboard-empty">Keine Aktivitäten im gewählten Zeitraum.</p>
      ) : (
        <div className="dashboard-feed">
          {items.map((item) => (
            <div key={item.id} className="dashboard-feed-item">
              <div className="dashboard-feed-row">
                <strong>{item.actor}</strong>
                <span>{formatDateTime(item.timestamp)}</span>
              </div>
              <p>
                {actionLabel(item.action)} · {item.entityType} · {item.entityTitle}
              </p>
              {item.severity ? (
                <span style={{ color: severityToColor(item.severity), fontWeight: 600 }}>{item.severity}</span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
