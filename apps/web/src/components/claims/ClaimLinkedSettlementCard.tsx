import type { InstrumentContext } from "@/lib/claims";
import { formatDateTime } from "@/lib/dashboard";

type ClaimLinkedSettlementCardProps = {
  context: InstrumentContext;
  settlementEventId?: string;
};

export function ClaimLinkedSettlementCard({ context, settlementEventId }: ClaimLinkedSettlementCardProps) {
  if (!settlementEventId) {
    return null;
  }

  const event = context.settlementEvents.find((entry) => entry.id === settlementEventId);
  if (!event) {
    return null;
  }

  return (
    <div className="claim-link-card">
      <strong>Settlement Event</strong>
      <p>
        {event.eventType} ({event.id})
      </p>
      <p>
        due: {formatDateTime(event.dueAt)} · expected {event.expectedAmount} {event.currency} · settled {event.settledAmount}{" "}
        {event.currency}
      </p>
      <p>
        status: {event.settlementStatus} · obligation: {event.obligationKey}
      </p>
      {event.breachFlags.length ? <p>breach flags: {event.breachFlags.join(", ")}</p> : null}
    </div>
  );
}
