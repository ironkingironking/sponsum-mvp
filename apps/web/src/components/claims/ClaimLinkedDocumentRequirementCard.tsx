import type { InstrumentContext } from "@/lib/claims";

type ClaimLinkedDocumentRequirementCardProps = {
  context: InstrumentContext;
  requirementInstanceId?: string;
  documentId?: string;
};

export function ClaimLinkedDocumentRequirementCard({
  context,
  requirementInstanceId,
  documentId
}: ClaimLinkedDocumentRequirementCardProps) {
  const requirement = requirementInstanceId
    ? context.documentRequirementInstances.find((entry) => entry.id === requirementInstanceId)
    : undefined;
  const definition = requirement
    ? context.documentRequirementDefinitions.find((entry) => entry.id === requirement.requirementId)
    : undefined;
  const document = documentId ? context.uploadedDocuments.find((entry) => entry.id === documentId) : undefined;

  if (!requirement && !document) {
    return null;
  }

  return (
    <div className="claim-link-card">
      <strong>Dokumentenverknüpfung</strong>
      {requirement ? (
        <>
          <p>
            Anforderung: {definition?.label || requirement.requirementId} ({requirement.id})
          </p>
          <p>Status: {requirement.status}</p>
        </>
      ) : null}
      {document ? (
        <>
          <p>
            Hochgeladenes Dokument: {document.title} ({document.id})
          </p>
          <p>
            Status: {document.status} · signiert: {document.signed ? "ja" : "nein"} · lesbar: {document.readable ? "ja" : "nein"}
          </p>
        </>
      ) : null}
    </div>
  );
}
