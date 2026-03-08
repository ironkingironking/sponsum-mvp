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
      <strong>Document Link</strong>
      {requirement ? (
        <>
          <p>
            requirement: {definition?.label || requirement.requirementId} ({requirement.id})
          </p>
          <p>status: {requirement.status}</p>
        </>
      ) : null}
      {document ? (
        <>
          <p>
            uploaded document: {document.title} ({document.id})
          </p>
          <p>
            status: {document.status} · signed: {document.signed ? "yes" : "no"} · readable: {document.readable ? "yes" : "no"}
          </p>
        </>
      ) : null}
    </div>
  );
}
