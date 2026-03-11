import Link from "next/link";
import { Card, SectionTitle } from "@sponsum/ui";
import { apiGet } from "@/lib/api";

type Listing = {
  id: string;
  status: string;
  askPrice: string;
  ownershipFraction: string;
  claim: {
    id: string;
    title: string;
    amount: string;
    currency: string;
    instrumentType: string;
    maturityDate: string;
    riskRating?: string;
    verificationBadge?: string;
    jurisdiction?: string;
  };
};

type MarketplaceCardModel = {
  id: string;
  claimId: string;
  title: string;
  amount: number;
  currency: string;
  dueDate: string;
  expectedReturn: number;
  riskLevel: "green" | "yellow" | "red";
  securityLevel: "secured" | "partially_secured" | "unsecured";
  issuerTrustScore: number;
  verificationBadge: string;
  issuerRating: string;
  previousDeals: number;
  collateralStatus: string;
  disputeHistory: string;
  status: string;
};

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function riskLevelFromRating(rating: string | undefined): MarketplaceCardModel["riskLevel"] {
  const normalized = (rating || "").toLowerCase();
  if (normalized.includes("low")) return "green";
  if (normalized.includes("high")) return "red";
  return "yellow";
}

function trafficLabel(level: MarketplaceCardModel["riskLevel"]): string {
  if (level === "green") return "Green";
  if (level === "yellow") return "Yellow";
  return "Red";
}

function trafficText(level: MarketplaceCardModel["riskLevel"]): string {
  if (level === "green") return "secured";
  if (level === "yellow") return "partially secured";
  return "unsecured";
}

function timelineStep(status: string): number {
  const normalized = status.toUpperCase();
  if (normalized === "DRAFT") return 1;
  if (normalized === "PUBLISHED") return 2;
  if (normalized === "ACTIVE") return 3;
  if (normalized === "OVERDUE") return 4;
  if (normalized === "FILLED" || normalized === "SETTLED" || normalized === "RESOLVED") return 5;
  return 2;
}

function amountLabel(value: number, currency: string): string {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function buildMarketplaceModel(listing: Listing, index: number): MarketplaceCardModel {
  const amount = toNumber(listing.claim.amount);
  const ask = toNumber(listing.askPrice);
  const expectedReturn = ask > 0 ? ((amount - ask) / ask) * 100 : 0;
  const riskLevel = riskLevelFromRating(listing.claim.riskRating);

  return {
    id: listing.id,
    claimId: listing.claim.id,
    title: listing.claim.title,
    amount,
    currency: listing.claim.currency || "CHF",
    dueDate: listing.claim.maturityDate,
    expectedReturn,
    riskLevel,
    securityLevel: riskLevel === "green" ? "secured" : riskLevel === "yellow" ? "partially_secured" : "unsecured",
    issuerTrustScore: Math.max(62, 88 - index * 4),
    verificationBadge: listing.claim.verificationBadge || "VERIFIED",
    issuerRating: index % 2 === 0 ? "A" : "B+",
    previousDeals: 3 + index * 2,
    collateralStatus: riskLevel === "red" ? "No collateral" : riskLevel === "yellow" ? "Partial collateral" : "Collateral verified",
    disputeHistory: index % 3 === 0 ? "No disputes" : "1 resolved dispute",
    status: listing.status
  };
}

const exampleListings: Listing[] = [
  {
    id: "example-1",
    status: "PUBLISHED",
    askPrice: "14500.00",
    ownershipFraction: "0.2500",
    claim: {
      id: "clm-wechsel-01",
      title: "Invoice claim: Alpine Steel receivable",
      amount: "15000.00",
      currency: "CHF",
      instrumentType: "INVOICE",
      maturityDate: "2026-08-15",
      riskRating: "MEDIUM",
      verificationBadge: "VERIFIED"
    }
  },
  {
    id: "example-2",
    status: "PUBLISHED",
    askPrice: "52000.00",
    ownershipFraction: "0.4000",
    claim: {
      id: "clm-zession-01",
      title: "Bill of exchange: Trade equipment",
      amount: "55000.00",
      currency: "EUR",
      instrumentType: "BILL_OF_EXCHANGE",
      maturityDate: "2027-02-03",
      riskRating: "HIGH",
      verificationBadge: "VERIFIED"
    }
  },
  {
    id: "example-3",
    status: "ACTIVE",
    askPrice: "40300.00",
    ownershipFraction: "1.0000",
    claim: {
      id: "clm-schuldschein-01",
      title: "Future receivable: SaaS contracts",
      amount: "42000.00",
      currency: "EUR",
      instrumentType: "FUTURE_PAYMENT",
      maturityDate: "2026-09-01",
      riskRating: "LOW",
      verificationBadge: "TRUSTED_ISSUER"
    }
  }
];

export default async function MarketplacePage() {
  const listings = await apiGet<Listing[]>("/marketplace/listings").catch(() => []);
  const rows = (listings.length ? listings : exampleListings).map(buildMarketplaceModel);

  return (
    <div className="container grid" style={{ gap: 16 }}>
      <Card>
        <SectionTitle title="Marketplace" subtitle="Compare claims with clear return, risk and trust indicators." />
        {listings.length === 0 ? (
          <p style={{ marginTop: 10, color: "#475569" }}>
            Demo data is shown because no live listings are currently available.
          </p>
        ) : null}
      </Card>

      {rows.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: "#475569" }}>No claims available right now.</p>
          <div style={{ marginTop: 10 }}>
            <Link href="/claims/create">
              <button type="button">Create your first claim</button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="marketplace-card-grid">
          {rows.map((row) => (
            <Card key={row.id}>
              <div className="market-card-header">
                <strong>{row.title}</strong>
                <span className={`risk-dot ${row.riskLevel}`}>{trafficLabel(row.riskLevel)}</span>
              </div>

              <p className="market-card-amount">{amountLabel(row.amount, row.currency)}</p>
              <p className="market-card-meta">
                Due {new Date(row.dueDate).toLocaleDateString("de-CH")} · Expected return {row.expectedReturn.toFixed(1)}%
              </p>

              {/* UX decision: trust indicators sit directly under amount/return so users can evaluate safety before opening details. */}
              <div className="trust-signal-grid">
                <span>Risk indicator: {trafficLabel(row.riskLevel)}</span>
                <span>Security level: {row.securityLevel.replaceAll("_", " ")}</span>
                <span>Security: {trafficText(row.riskLevel)}</span>
                <span>Issuer trust score: {row.issuerTrustScore}/100</span>
                <span>Verification: {row.verificationBadge}</span>
                <span>Issuer rating: {row.issuerRating}</span>
                <span>Previous deals: {row.previousDeals}</span>
                <span>Collateral: {row.collateralStatus}</span>
                <span>Dispute history: {row.disputeHistory}</span>
              </div>

              <div className="deal-timeline">
                {["Created", "Funded", "Active", "Due", "Settled"].map((label, index) => (
                  <div key={label} className={timelineStep(row.status) >= index + 1 ? "active" : ""}>
                    {label}
                  </div>
                ))}
              </div>

              <div className="market-card-actions">
                <Link href={`/claims/${row.claimId}`}>
                  <button type="button" className="ghost">
                    View details
                  </button>
                </Link>
                <button type="button">Invest</button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
