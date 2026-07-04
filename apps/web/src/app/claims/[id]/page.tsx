import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, SectionTitle } from "@sponsum/ui";
import { ClaimLinkedClauseCard } from "@/components/claims/ClaimLinkedClauseCard";
import { ClaimLinkedDocumentRequirementCard } from "@/components/claims/ClaimLinkedDocumentRequirementCard";
import { ClaimLinkedSettlementCard } from "@/components/claims/ClaimLinkedSettlementCard";
import { ClaimLinkedTemplateFieldCard } from "@/components/claims/ClaimLinkedTemplateFieldCard";
import { ClaimTargetSummary } from "@/components/claims/ClaimTargetSummary";
import { PublishClaimButton } from "@/components/claims/PublishClaimButton";
import { apiGet } from "@/lib/api";
import { claimMocks, deriveClaimTargetCandidates, getInstrumentContextById } from "@/lib/claims";
import { formatCurrency, formatDateTime, severityToColor } from "@/lib/dashboard";

type ApiClaimDetail = {
  id: string;
  title: string;
  instrumentType: string;
  status: string;
  amount: string | number;
  currency: string;
  issueDate: string;
  maturityDate: string;
  settlementModel: string;
  transferability: string;
  governingLaw: string;
  jurisdiction: string;
  humanSummary: string;
  riskRating?: string;
  verificationBadge?: string;
  createdAt: string;
  updatedAt: string;
  parties?: Array<{ id: string; role: string; displayName: string; userId?: string | null }>;
  listings?: Array<{ id: string; status: string; askPrice: string | number; ownershipFraction: string | number; buyerId?: string | null }>;
  settlementEvents?: Array<{ id: string; type: string; status: string; amountDue?: string | number | null; amountPaid?: string | number | null; createdAt: string }>;
  disputes?: Array<{ id: string; status: string; disputeType: string; disputeReason: string }>;
  collateralRecords?: Array<{ id: string; collateralType: string; status: string; valuation: string | number; currency: string }>;
  escrowArrangements?: Array<{ id: string; escrowAgent: string; status: string; amount: string | number; currency: string }>;
  custodyRecords?: Array<{ id: string; custodian: string; custodyStatus: string; custodyType: string }>;
};

function toNumber(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusTone(status: string): string {
  if (["DEFAULTED", "DISPUTED", "OVERDUE"].includes(status)) return "#b91c1c";
  if (["DRAFT", "ISSUED", "ACCEPTED"].includes(status)) return "#b45309";
  return "#166534";
}

function hasMarketplaceListing(claim: ApiClaimDetail): boolean {
  return Boolean(claim.listings?.some((listing) => listing.status !== "CANCELLED"));
}

function LiveClaimDetail({ claim }: { claim: ApiClaimDetail }) {
  const amount = toNumber(claim.amount);
  const listings = claim.listings ?? [];
  const settlementEvents = claim.settlementEvents ?? [];
  const parties = claim.parties ?? [];

  return (
    <div className="container grid" style={{ gap: 16 }}>
      <Card>
        <SectionTitle title={claim.title} subtitle={claim.humanSummary} />

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge label={claim.status} />
          <Badge label={claim.instrumentType} />
          <Badge label={claim.settlementModel} />
          <Badge label={claim.verificationBadge || "UNVERIFIED"} />
        </div>

        <div className="dashboard-list" style={{ marginTop: 12 }}>
          <div className="dashboard-list-item">
            <div>
              <strong>Claim value</strong>
              <p>{formatCurrency(amount, claim.currency)}</p>
            </div>
            <div className="dashboard-list-meta">
              <span style={{ color: statusTone(claim.status), fontWeight: 700 }}>{claim.status}</span>
              <span>Due: {formatDateTime(claim.maturityDate)}</span>
            </div>
          </div>

          <div className="dashboard-list-item">
            <div>
              <strong>Legal basis</strong>
              <p>
                {claim.governingLaw} · {claim.jurisdiction}
              </p>
              <p>{claim.transferability}</p>
            </div>
            <div className="dashboard-list-meta">
              <span>Risk: {claim.riskRating || "MEDIUM"}</span>
              <span>Issued: {formatDateTime(claim.issueDate)}</span>
            </div>
          </div>
        </div>
      </Card>

      {!hasMarketplaceListing(claim) ? (
        <Card>
          <SectionTitle title="Marketplace" subtitle="Publish this claim so investors can evaluate it." />
          <PublishClaimButton claimId={claim.id} defaultAskPrice={amount} />
        </Card>
      ) : (
        <Card>
          <SectionTitle title="Marketplace" subtitle="This claim has a live marketplace listing." />
          <Link href="/marketplace">
            <button type="button">Open marketplace</button>
          </Link>
        </Card>
      )}

      <div className="grid grid-2">
        <Card>
          <SectionTitle title="Parties" />
          {parties.length ? (
            <div className="dashboard-list">
              {parties.map((party) => (
                <div key={party.id} className="dashboard-list-item">
                  <div>
                    <strong>{party.displayName}</strong>
                    <p>{party.role}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="dashboard-empty">No parties linked yet.</p>
          )}
        </Card>

        <Card>
          <SectionTitle title="Listings" />
          {listings.length ? (
            <div className="dashboard-list">
              {listings.map((listing) => (
                <div key={listing.id} className="dashboard-list-item">
                  <div>
                    <strong>{formatCurrency(toNumber(listing.askPrice), claim.currency)}</strong>
                    <p>Fraction: {toNumber(listing.ownershipFraction).toLocaleString("de-CH")}</p>
                  </div>
                  <div className="dashboard-list-meta">
                    <span>{listing.status}</span>
                    {listing.buyerId ? <span>Buyer assigned</span> : <span>Open</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="dashboard-empty">No marketplace listing yet.</p>
          )}
        </Card>
      </div>

      <div className="grid grid-2">
        <Card>
          <SectionTitle title="Settlement" />
          {settlementEvents.length ? (
            <div className="dashboard-list">
              {settlementEvents.map((event) => (
                <div key={event.id} className="dashboard-list-item">
                  <div>
                    <strong>{event.type}</strong>
                    <p>{event.status}</p>
                  </div>
                  <div className="dashboard-list-meta">
                    {event.amountPaid ? <span>Paid: {formatCurrency(toNumber(event.amountPaid), claim.currency)}</span> : null}
                    <span>{formatDateTime(event.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="dashboard-empty">No settlement events yet.</p>
          )}
        </Card>

        <Card>
          <SectionTitle title="Trust Controls" />
          <div className="trust-signal-grid">
            <span>Collateral records: {claim.collateralRecords?.length ?? 0}</span>
            <span>Escrow arrangements: {claim.escrowArrangements?.length ?? 0}</span>
            <span>Custody records: {claim.custodyRecords?.length ?? 0}</span>
            <span>Disputes: {claim.disputes?.length ?? 0}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default async function ClaimDetailPage({ params }: { params: { id: string } }) {
  const liveClaim = await apiGet<ApiClaimDetail>(`/claims/${params.id}`).catch(() => null);

  if (liveClaim) {
    return <LiveClaimDetail claim={liveClaim} />;
  }

  return <MockClaimDetailPage id={params.id} />;
}

function MockClaimDetailPage({ id }: { id: string }) {
  const claim = claimMocks.find((entry) => entry.id === id);
  if (!claim) {
    return (
      <div className="container grid" style={{ gap: 16 }}>
        <Card>
          <SectionTitle title="Claim detail unavailable" subtitle="This deal is not part of local demo data." />
          <p style={{ color: "#475569", margin: 0 }}>
            You can still browse marketplace cards or create your own claim.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Link href="/marketplace">
              <button type="button">Back to marketplace</button>
            </Link>
            <Link href="/claims/create">
              <button type="button" className="ghost">
                Create claim
              </button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const context = getInstrumentContextById(claim.instrumentId);
  if (!context) {
    notFound();
  }

  const claimTarget = deriveClaimTargetCandidates(context).find((target) => {
    if (target.targetType !== claim.targetType) return false;
    if (claim.targetTemplateFieldId && target.templateFieldId === claim.targetTemplateFieldId) return true;
    if (claim.targetClauseBlockId && target.clauseBlockId === claim.targetClauseBlockId) return true;
    if (claim.targetSettlementEventId && target.settlementEventId === claim.targetSettlementEventId) return true;
    if (claim.targetDocumentRequirementId && target.documentRequirementId === claim.targetDocumentRequirementId) return true;
    if (claim.targetDocumentId && target.documentId === claim.targetDocumentId) return true;
    if (claim.targetObligationKey && target.obligationKey === claim.targetObligationKey) return true;
    return false;
  });

  return (
    <div className="grid" style={{ gap: 16 }}>
      <Card>
        <SectionTitle title={claim.title} subtitle={claim.summary} />

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge label={claim.status} />
          <Badge label={claim.claimType} />
          <Badge label={claim.category} />
          <Badge label={claim.targetType} />
        </div>

        <div className="dashboard-list" style={{ marginTop: 12 }}>
          <div className="dashboard-list-item">
            <div>
              <strong>Instrument</strong>
              <p>{context.title}</p>
              <p>Template: {context.template.title}</p>
            </div>
            <div className="dashboard-list-meta">
              <span style={{ color: severityToColor(claim.severity), fontWeight: 700 }}>{claim.severity}</span>
              <span>Erstellt: {formatDateTime(claim.createdAt)}</span>
            </div>
          </div>

          <div className="dashboard-list-item">
            <div>
              <strong>Statement</strong>
              <p>{claim.statementByClaimant}</p>
            </div>
          </div>

          <div className="dashboard-list-item">
            <div>
              <strong>Streitwert</strong>
              <p>
                {claim.amountInDispute !== undefined
                  ? formatCurrency(claim.amountInDispute, claim.currency || "CHF")
                  : "Kein monetärer Streitwert"}
              </p>
            </div>
            <div className="dashboard-list-meta">
              {claim.requestedDeadline ? <span>Frist: {formatDateTime(claim.requestedDeadline)}</span> : null}
              <span>Aktualisiert: {formatDateTime(claim.updatedAt)}</span>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Claim-Ziel und Soll-/Ist-Abweichung" />
        <ClaimTargetSummary target={claimTarget} />
      </Card>

      <div className="grid grid-2">
        <Card>
          <SectionTitle title="Evidence" />
          {claim.evidenceTypes.length ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {claim.evidenceTypes.map((evidence) => (
                <li key={evidence}>{evidence}</li>
              ))}
            </ul>
          ) : (
            <p className="dashboard-empty">Keine Evidence-Typen hinterlegt.</p>
          )}
        </Card>

        <Card>
          <SectionTitle title="Remedies" />
          {claim.requestedRemedy.length ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {claim.requestedRemedy.map((remedy) => (
                <li key={remedy}>{remedy}</li>
              ))}
            </ul>
          ) : (
            <p className="dashboard-empty">Keine Remedies hinterlegt.</p>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle title="Verknüpfte Instrumentbestandteile" />
        <div className="grid">
          <ClaimLinkedTemplateFieldCard
            context={context}
            fieldId={claim.targetTemplateFieldId}
            expectedValue={claim.expectedValue}
            actualValue={claim.actualValue}
          />
          <ClaimLinkedClauseCard context={context} clauseId={claim.targetClauseBlockId} />
          <ClaimLinkedSettlementCard context={context} settlementEventId={claim.targetSettlementEventId} />
          <ClaimLinkedDocumentRequirementCard
            context={context}
            requirementInstanceId={claim.targetDocumentRequirementId}
            documentId={claim.targetDocumentId}
          />
        </div>
      </Card>

      <Card>
        <SectionTitle title="Snapshot bei Erstellung" />
        <pre style={{ margin: 0 }}>{JSON.stringify(claim.targetValueSnapshot, null, 2)}</pre>
      </Card>
    </div>
  );
}
