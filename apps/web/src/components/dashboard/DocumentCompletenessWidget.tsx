import type { DocumentCompletenessItem } from "@/lib/dashboard";
import { WidgetCard } from "./WidgetCard";

type DocumentCompletenessWidgetProps = {
  items: DocumentCompletenessItem[];
};

export function DocumentCompletenessWidget({ items }: DocumentCompletenessWidgetProps) {
  return (
    <WidgetCard title="Document Completeness" subtitle="Pflichtdokumente und Signaturen">
      {items.length === 0 ? (
        <p className="dashboard-empty">Alle Dokumentsets sind vollständig.</p>
      ) : (
        <div className="dashboard-table-wrap">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Instrument</th>
                <th>Required</th>
                <th>Uploaded</th>
                <th>Missing</th>
                <th>Missing Signatures</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.instrumentId}>
                  <td>{item.instrumentTitle}</td>
                  <td>{item.requiredCount}</td>
                  <td>{item.uploadedCount}</td>
                  <td>{item.missingCount}</td>
                  <td>{item.missingSignatures}</td>
                  <td>{item.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </WidgetCard>
  );
}
