"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, SectionTitle } from "@sponsum/ui";
import { MarketplaceInvestButton } from "@/components/marketplace/MarketplaceInvestButton";
import { AuthUser, getApiBaseUrl, getStoredSession, subscribeToAuthChanges } from "@/lib/auth";

type MoneyValue = string | number | null | undefined;

type ApiSettlementEvent = {
  id: string;
  type?: string;
  eventType?: string;
  status: string;
  dueDate?: string | null;
  amountDue?: MoneyValue;
  amountPaid?: MoneyValue;
  createdAt?: string;
};

type ApiClaimParty = {
  id: string;
  role: string;
  displayName: string;
  userId?: string | null;
};

type ApiClaim = {
  id: string;
  title: string;
  amount: MoneyValue;
  currency: string;
  maturityDate: string;
  status: string;
  instrumentType?: string;
  createdById?: string;
  issuerId?: string | null;
  riskRating?: string;
  verificationBadge?: string;
  settlementEvents?: ApiSettlementEvent[];
  parties?: ApiClaimParty[];
  listings?: Array<{
    id: string;
    status: string;
    sellerId: string;
    buyerId?: string | null;
    askPrice: MoneyValue;
    ownershipFraction: MoneyValue;
  }>;
};

type ApiUser = {
  id: string;
  fullName: string;
  email?: string;
};

type ApiListing = {
  id: string;
  claimId: string;
  sellerId: string;
  buyerId?: string | null;
  status: string;
  askPrice: MoneyValue;
  ownershipFraction: MoneyValue;
  transferConditions?: string;
  createdAt?: string;
  updatedAt?: string;
  seller?: ApiUser;
  buyer?: ApiUser | null;
  claim: ApiClaim;
};

type ApiDispute = {
  id: string;
  relatedClaimId: string;
  disputeType: string;
  disputeReason: string;
  status: string;
  createdAt?: string;
};

type DealPhase = "open" | "owned" | "settling" | "disputed" | "paid" | "defaulted";
type DealRelationship = "buyer" | "seller" | "issuer" | "market";
type DealsView = "investments" | "claims";

type DealRow = {
  id: string;
  claimId: string;
  listingId?: string;
  title: string;
  amount: number;
  askPrice: number;
  currency: string;
  maturityDate: string;
  claimStatus: string;
  listingStatus?: string;
  relationship: DealRelationship;
  phase: DealPhase;
  riskRating: string;
  verificationBadge: string;
  ownershipFraction: number;
  sellerName?: string;
  buyerName?: string;
  settlementEvents: ApiSettlementEvent[];
  disputes: ApiDispute[];
};

const phaseLabels: Record<DealPhase, string> = {
  open: "Open",
  owned: "Owned",
  settling: "Settling",
  disputed: "Disputed",
  paid: "Paid",
  defaulted: "Defaulted"
};

const timelineLabels = ["Open", "Owned", "Settling", "Risk", "Paid"] as const;

function toNumber(value: MoneyValue): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalize(value: string | undefined | null): string {
  return String(value ?? "").toUpperCase();
}

function formatMoney(value: MoneyValue, currency = "CHF"): string {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency, maximumFractionDigits: 0 }).format(toNumber(value));
}

function formatExposure(rows: DealRow[]): string {
  if (!rows.length) return formatMoney(0, "CHF");

  const totals = new Map<string, number>();
  for (const row of rows) {
    const value = row.askPrice || row.amount * row.ownershipFraction;
    totals.set(row.currency, (totals.get(row.currency) ?? 0) + value);
  }

  return [...totals.entries()].map(([currency, value]) => formatMoney(value, currency)).join(" / ");
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat("de-CH", { maximumFractionDigits: 1 }).format(value);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString("de-CH");
}

function isOpenListing(status: string): boolean {
  return ["PUBLISHED", "ACTIVE"].includes(normalize(status));
}

function isClosedDispute(dispute: ApiDispute): boolean {
  return ["RESOLVED", "REJECTED"].includes(normalize(dispute.status));
}

function latestSettlement(events: ApiSettlementEvent[]): ApiSettlementEvent | null {
  if (!events.length) return null;
  return [...events].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0] ?? null;
}

function classifyDeal(row: {
  claimStatus: string;
  listingStatus?: string;
  buyerId?: string | null;
  relationship: DealRelationship;
  settlementEvents: ApiSettlementEvent[];
  disputes: ApiDispute[];
}): DealPhase {
  const claimStatus = normalize(row.claimStatus);
  const listingStatus = normalize(row.listingStatus);
  const hasOpenDispute = row.disputes.some((dispute) => !isClosedDispute(dispute));
  const lastSettlement = latestSettlement(row.settlementEvents);
  const lastSettlementStatus = normalize(lastSettlement?.status);

  if (hasOpenDispute || claimStatus === "DISPUTED") return "disputed";
  if (["OVERDUE", "DEFAULTED", "IN_ENFORCEMENT"].includes(claimStatus) || lastSettlementStatus === "DEFAULTED") {
    return "defaulted";
  }
  if (["SETTLED", "RESOLVED"].includes(claimStatus) || ["SETTLED", "RESOLVED"].includes(lastSettlementStatus)) {
    return "paid";
  }
  if (!row.buyerId && isOpenListing(row.listingStatus ?? "")) return "open";
  if (row.relationship === "buyer" && row.settlementEvents.length > 0) return "settling";
  if (row.relationship === "buyer") return "owned";
  if (listingStatus === "FILLED" || ["ACTIVE", "PARTIALLY_SETTLED", "ACCEPTED"].includes(claimStatus)) return "settling";
  return "open";
}

function phaseStep(phase: DealPhase): number {
  if (phase === "open") return 1;
  if (phase === "owned") return 2;
  if (phase === "settling") return 3;
  if (phase === "disputed" || phase === "defaulted") return 4;
  return 5;
}

function expectedReturn(row: DealRow): number {
  if (row.askPrice <= 0) return 0;
  const expectedValue = row.amount * row.ownershipFraction;
  return ((expectedValue - row.askPrice) / row.askPrice) * 100;
}

function relationshipForListing(listing: ApiListing, userId?: string): DealRelationship {
  if (userId && listing.buyerId === userId) return "buyer";
  if (userId && listing.sellerId === userId) return "seller";
  if (userId && (listing.claim.createdById === userId || listing.claim.issuerId === userId)) return "issuer";
  return "market";
}

function userOwnsClaim(claim: ApiClaim, userId?: string): boolean {
  if (!userId) return false;
  if (claim.createdById === userId || claim.issuerId === userId) return true;
  return Boolean(claim.parties?.some((party) => party.userId === userId && ["issuer", "seller", "owner"].includes(party.role.toLowerCase())));
}

function buildListingRow(listing: ApiListing, claim: ApiClaim, disputes: ApiDispute[], userId?: string): DealRow {
  const settlementEvents = claim.settlementEvents ?? [];
  const relationship = relationshipForListing(listing, userId);
  const phase = classifyDeal({
    claimStatus: claim.status,
    listingStatus: listing.status,
    buyerId: listing.buyerId,
    relationship,
    settlementEvents,
    disputes
  });

  return {
    id: `listing-${listing.id}`,
    claimId: claim.id,
    listingId: listing.id,
    title: claim.title,
    amount: toNumber(claim.amount),
    askPrice: toNumber(listing.askPrice),
    currency: claim.currency || "CHF",
    maturityDate: claim.maturityDate,
    claimStatus: claim.status,
    listingStatus: listing.status,
    relationship,
    phase,
    riskRating: claim.riskRating || "MEDIUM",
    verificationBadge: claim.verificationBadge || "UNVERIFIED",
    ownershipFraction: toNumber(listing.ownershipFraction || 1),
    sellerName: listing.seller?.fullName,
    buyerName: listing.buyer?.fullName,
    settlementEvents,
    disputes
  };
}

function buildClaimRow(claim: ApiClaim, disputes: ApiDispute[]): DealRow {
  const settlementEvents = claim.settlementEvents ?? [];
  const phase = classifyDeal({
    claimStatus: claim.status,
    relationship: "issuer",
    settlementEvents,
    disputes
  });

  return {
    id: `claim-${claim.id}`,
    claimId: claim.id,
    title: claim.title,
    amount: toNumber(claim.amount),
    askPrice: 0,
    currency: claim.currency || "CHF",
    maturityDate: claim.maturityDate,
    claimStatus: claim.status,
    relationship: "issuer",
    phase,
    riskRating: claim.riskRating || "MEDIUM",
    verificationBadge: claim.verificationBadge || "UNVERIFIED",
    ownershipFraction: 1,
    settlementEvents,
    disputes
  };
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return response.json() as Promise<T>;
}

function StatusPill({ phase }: { phase: DealPhase }) {
  return <span className={`status-pill deal-phase-${phase}`}>{phaseLabels[phase]}</span>;
}

function DealTimeline({ phase }: { phase: DealPhase }) {
  const activeStep = phaseStep(phase);

  return (
    <div className="deal-timeline">
      {timelineLabels.map((label, index) => (
        <div key={label} className={activeStep >= index + 1 ? "active" : ""}>
          {label}
        </div>
      ))}
    </div>
  );
}

function DealCard({ row, canInvest, onRefresh }: { row: DealRow; canInvest: boolean; onRefresh: () => void }) {
  const lastSettlement = latestSettlement(row.settlementEvents);
  const openDisputeCount = row.disputes.filter((dispute) => !isClosedDispute(dispute)).length;
  const returnValue = expectedReturn(row);

  return (
    <Card>
      <div className="deal-card-head">
        <div>
          <strong>{row.title}</strong>
          <p>
            {formatMoney(row.amount, row.currency)} claim value / due {formatDate(row.maturityDate)}
          </p>
        </div>
        <StatusPill phase={row.phase} />
      </div>

      <div className="deal-metric-grid">
        <div>
          <span>Position</span>
          <strong>{row.listingId ? formatMoney(row.askPrice, row.currency) : "Not listed"}</strong>
        </div>
        <div>
          <span>Ownership</span>
          <strong>{formatPercent(row.ownershipFraction * 100)}%</strong>
        </div>
        <div>
          <span>Upside</span>
          <strong>{row.listingId ? `${formatPercent(returnValue)}%` : "Pending"}</strong>
        </div>
        <div>
          <span>Risk</span>
          <strong>{row.riskRating}</strong>
        </div>
      </div>

      <div className="trust-signal-grid">
        <span>Claim status: {row.claimStatus}</span>
        <span>Listing: {row.listingStatus || "No listing"}</span>
        <span>Verification: {row.verificationBadge}</span>
        <span>Settlement: {lastSettlement ? `${lastSettlement.type || lastSettlement.eventType} / ${lastSettlement.status}` : "No events"}</span>
        <span>Disputes: {openDisputeCount ? `${openDisputeCount} open` : "None open"}</span>
        <span>Counterparty: {row.buyerName || row.sellerName || "Open market"}</span>
      </div>

      <DealTimeline phase={row.phase} />

      <div className="deal-card-actions">
        <Link href={`/claims/${row.claimId}`}>
          <button type="button" className="ghost">
            View details
          </button>
        </Link>
        {canInvest && row.listingId ? (
          <MarketplaceInvestButton listingId={row.listingId} status={row.listingStatus || ""} onSuccess={onRefresh} />
        ) : (
          <Link href="/marketplace">
            <button type="button">Marketplace</button>
          </Link>
        )}
      </div>
    </Card>
  );
}

function EmptyState({ view, hasUser }: { view: DealsView; hasUser: boolean }) {
  if (!hasUser) {
    return (
      <Card>
        <div className="deal-empty">
          <p>Sign in to see your portfolio, purchases, and settlement queue.</p>
          <div className="deal-card-actions">
            <Link href="/auth/login">
              <button type="button">Login</button>
            </Link>
            <Link href="/auth/register">
              <button type="button" className="ghost">
                Register
              </button>
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="deal-empty">
        <p>{view === "claims" ? "No issuer claims are linked to your account yet." : "No purchased investments are linked to your account yet."}</p>
        <div className="deal-card-actions">
          <Link href={view === "claims" ? "/claims/create" : "/marketplace"}>
            <button type="button">{view === "claims" ? "Create claim" : "Open marketplace"}</button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

export function DealsInvestmentWorkbench() {
  const searchParams = useSearchParams();
  const view: DealsView = searchParams.get("view") === "claims" ? "claims" : "investments";
  const [user, setUser] = useState<AuthUser | null>(null);
  const [listings, setListings] = useState<ApiListing[]>([]);
  const [claims, setClaims] = useState<ApiClaim[]>([]);
  const [disputes, setDisputes] = useState<ApiDispute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [listingData, claimData, disputeData] = await Promise.all([
        fetchJson<ApiListing[]>("/marketplace/listings"),
        fetchJson<ApiClaim[]>("/claims"),
        fetchJson<ApiDispute[]>("/disputes")
      ]);
      setListings(listingData);
      setClaims(claimData);
      setDisputes(disputeData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load deals.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const updateUser = () => setUser(getStoredSession()?.user ?? null);
    updateUser();
    return subscribeToAuthChanges(updateUser);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const rows = useMemo(() => {
    const userId = user?.id;
    const claimById = new Map(claims.map((claim) => [claim.id, claim]));
    const disputesByClaim = new Map<string, ApiDispute[]>();

    for (const dispute of disputes) {
      const existing = disputesByClaim.get(dispute.relatedClaimId) ?? [];
      existing.push(dispute);
      disputesByClaim.set(dispute.relatedClaimId, existing);
    }

    const listedClaimIds = new Set<string>();
    const listingRows = listings.map((listing) => {
      const claim = claimById.get(listing.claimId) ?? listing.claim;
      listedClaimIds.add(claim.id);
      return buildListingRow(listing, claim, disputesByClaim.get(claim.id) ?? [], userId);
    });

    const claimRows = claims
      .filter((claim) => !listedClaimIds.has(claim.id) && userOwnsClaim(claim, userId))
      .map((claim) => buildClaimRow(claim, disputesByClaim.get(claim.id) ?? []));

    return [...listingRows, ...claimRows];
  }, [claims, disputes, listings, user?.id]);

  const ownedRows = rows.filter((row) => row.relationship === "buyer");
  const issuerRows = rows.filter((row) => row.relationship === "seller" || row.relationship === "issuer");
  const openRows = rows.filter((row) => row.phase === "open" && row.relationship === "market" && row.listingId);
  const visibleRows = view === "claims" ? issuerRows : ownedRows;
  const attentionRows = visibleRows.filter((row) => row.phase === "disputed" || row.phase === "defaulted");
  const settlingRows = visibleRows.filter((row) => row.phase === "settling");
  const paidRows = visibleRows.filter((row) => row.phase === "paid");
  const exposureLabel = formatExposure(visibleRows);

  return (
    <div className="container deals-shell">
      <Card>
        <div className="deal-workbench-header">
          <SectionTitle
            title={view === "claims" ? "My Claims" : "Investments"}
            subtitle={
              view === "claims"
                ? "Issuer-side claims, listings, settlements and dispute signals."
                : "Live investment positions, open opportunities and settlement signals."
            }
          />
          <div className="deal-view-switch">
            <Link href="/deals?view=investments" className={view === "investments" ? "active" : ""}>
              Investments
            </Link>
            <Link href="/deals?view=claims" className={view === "claims" ? "active" : ""}>
              My Claims
            </Link>
          </div>
        </div>
      </Card>

      <div className="grid grid-3">
        <Card>
          <p className="summary-label">{view === "claims" ? "Issuer exposure" : "Portfolio value"}</p>
          <p className="summary-value">{exposureLabel}</p>
        </Card>
        <Card>
          <p className="summary-label">Settling</p>
          <p className="summary-value">{settlingRows.length}</p>
        </Card>
        <Card>
          <p className="summary-label">Needs attention</p>
          <p className="summary-value">{attentionRows.length}</p>
        </Card>
      </div>

      {error ? (
        <Card>
          <div className="deal-alert">
            <p>{error}</p>
            <button type="button" onClick={loadData}>
              Retry
            </button>
          </div>
        </Card>
      ) : null}

      {isLoading ? (
        <Card>
          <p style={{ margin: 0, color: "#475569" }}>Loading live deals...</p>
        </Card>
      ) : (
        <>
          <section className="deal-section">
            <div className="deal-section-head">
              <div>
                <h3>{view === "claims" ? "Issuer queue" : "Portfolio"}</h3>
                <p>
                  {visibleRows.length} active row{visibleRows.length === 1 ? "" : "s"} / {paidRows.length} paid
                </p>
              </div>
              <button type="button" className="ghost" onClick={loadData}>
                Refresh
              </button>
            </div>

            {visibleRows.length ? (
              <div className="grid" style={{ gap: 10 }}>
                {visibleRows.map((row) => (
                  <DealCard key={row.id} row={row} canInvest={false} onRefresh={loadData} />
                ))}
              </div>
            ) : (
              <EmptyState view={view} hasUser={Boolean(user)} />
            )}
          </section>

          {view === "investments" ? (
            <section className="deal-section">
              <div className="deal-section-head">
                <div>
                  <h3>Open opportunities</h3>
                  <p>{openRows.length} live listing{openRows.length === 1 ? "" : "s"}</p>
                </div>
                <Link href="/marketplace" className="dashboard-widget-link">
                  Marketplace
                </Link>
              </div>

              {openRows.length ? (
                <div className="grid" style={{ gap: 10 }}>
                  {openRows.slice(0, 4).map((row) => (
                    <DealCard key={row.id} row={row} canInvest={Boolean(user)} onRefresh={loadData} />
                  ))}
                </div>
              ) : (
                <Card>
                  <p style={{ margin: 0, color: "#475569" }}>No open marketplace listings are available right now.</p>
                </Card>
              )}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
