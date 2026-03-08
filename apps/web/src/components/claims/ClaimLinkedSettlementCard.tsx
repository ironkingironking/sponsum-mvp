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
      <strong>Settlement-Ereignis</strong>
      <p>
        {event.eventType} ({event.id})
      </p>
      <p>
        fällig: {formatDateTime(event.dueAt)} · erwartet {event.expectedAmount} {event.currency} · erfüllt {event.settledAmount}{" "}
        {event.currency}
      </p>
      <p>
        Status: {event.settlementStatus} · Obligation: {event.obligationKey}
      </p>
      {event.breachFlags.length ? <p>Breach-Flags: {event.breachFlags.join(", ")}</p> : null}
    </div>
  );
}
