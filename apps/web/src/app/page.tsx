import Link from "next/link";
import { Card, SectionTitle } from "@sponsum/ui";

export default function LandingPage() {
  return (
    <div className="container grid" style={{ gap: 20 }}>
      <Card>
        <SectionTitle
          title="Trade financial claims in minutes"
          subtitle="Create claims, find investors, and track settlement with clear risk and trust signals."
        />
        <p style={{ color: "#475569" }}>
          Sponsum helps you trade invoices, bills of exchange, future receivables, tax refunds and other claim-based deals
          without legal complexity.
        </p>
        <div className="primary-action-grid" style={{ marginTop: 12 }}>
          <Link href="/claims/create" className="primary-action-card">
            <strong>Create Claim</strong>
            <p>Use the 4-step wizard and publish your deal.</p>
          </Link>
          <Link href="/marketplace" className="primary-action-card">
            <strong>Invest in Claim</strong>
            <p>Compare return, risk and issuer trust in one view.</p>
          </Link>
          <Link href="/deals" className="primary-action-card">
            <strong>Track Settlement</strong>
            <p>Follow each deal from created to settled.</p>
          </Link>
        </div>
      </Card>

      <div className="grid grid-2">
        <Card>
          <SectionTitle title="How it works" subtitle="Understand the platform in 30 seconds." />
          <ol style={{ margin: 0, paddingLeft: 18, color: "#334155" }}>
            <li>Create a claim with basic details and debtor information.</li>
            <li>Publish to the marketplace and receive investor interest.</li>
            <li>Track funding, settlement and disputes in your timeline.</li>
          </ol>
        </Card>

        <Card>
          <SectionTitle title="Trust by default" subtitle="Every deal shows key safety indicators." />
          <ul style={{ margin: 0, paddingLeft: 18, color: "#334155" }}>
            <li>Verification badge and issuer rating</li>
            <li>Risk light: green, yellow or red</li>
            <li>Collateral and guarantor status</li>
            <li>Dispute history and previous deal count</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

