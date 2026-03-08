import { WidgetCard } from "@/components/dashboard";
import type { InstrumentContext } from "@/lib/claims";
import type { StructuredDisputeCase } from "@/lib/disputes";

type DisputeLinkedInstrumentMapProps = {
  dispute: StructuredDisputeCase;
  context?: InstrumentContext;
};

function uniqueValues(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export function DisputeLinkedInstrumentMap({ dispute, context }: DisputeLinkedInstrumentMapProps) {
  const templateFields = uniqueValues(dispute.claims.map((claim) => claim.targetTemplateFieldId));
  const clauseBlocks = uniqueValues(dispute.claims.map((claim) => claim.targetClauseBlockId));
  const settlementEvents = uniqueValues(dispute.claims.map((claim) => claim.targetSettlementEventId));
  const documentRequirements = uniqueValues(dispute.claims.map((claim) => claim.targetDocumentRequirementId));
  const obligations = uniqueValues(dispute.claims.map((claim) => claim.targetObligationKey));
  const groups = uniqueValues(dispute.claims.map((claim) => claim.targetGroupKey));
  const partyRoles = uniqueValues(dispute.claims.map((claim) => claim.targetPartyRole));

  return (
    <WidgetCard title="Verknüpfte Instrument-Map" subtitle="Welche Instrumentteile im Dispute betroffen sind.">
      <div className="dashboard-list">
        <div className="dashboard-list-item">
          <div>
            <strong>Instrument</strong>
            <p>{dispute.instrumentTitle}</p>
            {context ? <p>Template: {context.template.title}</p> : null}
          </div>
        </div>

        <div className="dashboard-list-item">
          <div>
            <strong>Betroffene Gruppen</strong>
            <p>{groups.length ? groups.join(", ") : "Keine Gruppen-Referenzen"}</p>
          </div>
        </div>

        <div className="dashboard-list-item">
          <div>
            <strong>Template-Felder</strong>
            <p>{templateFields.length ? templateFields.join(", ") : "Keine Feld-Referenzen"}</p>
          </div>
        </div>

        <div className="dashboard-list-item">
          <div>
            <strong>Klauselblöcke</strong>
            <p>{clauseBlocks.length ? clauseBlocks.join(", ") : "Keine Klausel-Referenzen"}</p>
          </div>
        </div>

        <div className="dashboard-list-item">
          <div>
            <strong>Settlement-Events</strong>
            <p>{settlementEvents.length ? settlementEvents.join(", ") : "Keine Settlement-Referenzen"}</p>
          </div>
        </div>

        <div className="dashboard-list-item">
          <div>
            <strong>Dokumentenpflichten</strong>
            <p>{documentRequirements.length ? documentRequirements.join(", ") : "Keine Dokument-Referenzen"}</p>
          </div>
        </div>

        <div className="dashboard-list-item">
          <div>
            <strong>Obligationen</strong>
            <p>{obligations.length ? obligations.join(", ") : "Keine Obligationen-Referenzen"}</p>
          </div>
        </div>

        <div className="dashboard-list-item">
          <div>
            <strong>Parteirole(n)</strong>
            <p>{partyRoles.length ? partyRoles.join(", ") : "Keine Rollen-Referenzen"}</p>
          </div>
        </div>
      </div>
    </WidgetCard>
  );
}
