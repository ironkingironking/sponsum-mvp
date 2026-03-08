import type { UpcomingDeadline } from "@/lib/dashboard";
import { formatDate, formatRelativeDays } from "@/lib/dashboard";
import { WidgetCard } from "./WidgetCard";

type UpcomingDeadlinesWidgetProps = {
  items: UpcomingDeadline[];
};

export function UpcomingDeadlinesWidget({ items }: UpcomingDeadlinesWidgetProps) {
  return (
    <WidgetCard title="Upcoming Deadlines" subtitle="Fälligkeiten und Reaktionsfristen in den nächsten 14 Tagen">
      {items.length === 0 ? (
        <p className="dashboard-empty">Keine Fristen im Betrachtungszeitraum.</p>
      ) : (
        <div className="dashboard-list">
          {items.map((item) => (
            <div key={item.id} className="dashboard-list-item">
              <div>
                <strong>{item.title}</strong>
                <p>
                  {item.kind} · {item.status}
                </p>
              </div>
              <div className="dashboard-list-meta">
                <span>{formatDate(item.dueDate)}</span>
                <span>{formatRelativeDays(item.dueDate)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
