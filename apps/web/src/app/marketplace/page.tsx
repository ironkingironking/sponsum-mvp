import Link from "next/link";
import { Badge, Card, SectionTitle } from "@sponsum/ui";
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
    riskRating: string;
    verificationBadge: string;
    jurisdiction: string;
  };
};

const exampleListings: Listing[] = [
  {
    id: "example-1",
    status: "PUBLISHED",
    askPrice: "14500.00",
    ownershipFraction: "0.2500",
    claim: {
      id: "example-claim-1",
      title: "Invoice Sale: Alpine Steel Receivable",
      amount: "15000.00",
      currency: "CHF",
      instrumentType: "INVOICE_SALE",
      maturityDate: "2026-08-15",
      riskRating: "MEDIUM",
      verificationBadge: "VERIFIED",
      jurisdiction: "Zurich"
    }
  },
  {
    id: "example-2",
    status: "PUBLISHED",
    askPrice: "52000.00",
    ownershipFraction: "0.4000",
    claim: {
      id: "example-claim-2",
      title: "Collateralized Borrowing: Machine Lien",
      amount: "55000.00",
      currency: "EUR",
      instrumentType: "COLLATERALIZED_BORROWING",
      maturityDate: "2027-02-03",
      riskRating: "MEDIUM",
      verificationBadge: "VERIFIED",
      jurisdiction: "Munich"
    }
  },
  {
    id: "example-3",
    status: "PUBLISHED",
    askPrice: "40300.00",
    ownershipFraction: "1.0000",
    claim: {
      id: "example-claim-3",
      title: "Bill of Exchange: Trade Drawer/Drawee",
      amount: "42000.00",
      currency: "EUR",
      instrumentType: "BILL_OF_EXCHANGE",
      maturityDate: "2026-09-01",
      riskRating: "LOW",
      verificationBadge: "VERIFIED",
      jurisdiction: "Basel"
    }
  },
  {
    id: "example-4",
    status: "FILLED",
    askPrice: "9400.00",
    ownershipFraction: "1.0000",
    claim: {
      id: "example-claim-4",
      title: "Guarantee Attachment: Debtor Payment Support",
      amount: "10000.00",
      currency: "CHF",
      instrumentType: "GUARANTEE_ATTACHMENT",
      maturityDate: "2026-10-01",
      riskRating: "LOW",
      verificationBadge: "TRUSTED_ISSUER",
      jurisdiction: "Geneva"
    }
  }
];

export default async function MarketplacePage() {
  const listings = await apiGet<Listing[]>("/marketplace/listings").catch(() => []);
  const data = listings.length > 0 ? listings : exampleListings;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <Card>
        <SectionTitle title="Marketplace" subtitle="Trade full or fractional claims across instruments." />
        {listings.length === 0 && (
          <p style={{ marginTop: 10, color: "#475569" }}>
            Showing demo examples because no seeded listings are currently available.
          </p>
        )}
      </Card>

      <div className="grid grid-2">
        {data.map((listing) => (
          <Card key={listing.id}>
            {listing.id.startsWith("example-") && (
              <p style={{ marginTop: 0, marginBottom: 8, color: "#475569", fontSize: 13 }}>Demo listing</p>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <strong>{listing.claim.title}</strong>
              <Badge label={listing.status} />
            </div>
            <p style={{ color: "#475569" }}>{listing.claim.instrumentType}</p>
            <p>
              Claim amount: {listing.claim.amount} {listing.claim.currency}
            </p>
            <p>Ask price: {listing.askPrice}</p>
            <p>Ownership fraction: {listing.ownershipFraction}</p>
            <p style={{ color: "#475569" }}>
              Risk: {listing.claim.riskRating} · Verification: {listing.claim.verificationBadge}
            </p>
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              {listing.id.startsWith("example-") ? (
                <button disabled>Demo Only</button>
              ) : (
                <Link href={`/claims/${listing.claim.id}`}><button>View Claim</button></Link>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
