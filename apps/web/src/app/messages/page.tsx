import Link from "next/link";
import { Card, SectionTitle } from "@sponsum/ui";

export default function MessagesPage() {
  return (
    <div className="container grid" style={{ gap: 16 }}>
      <Card>
        <SectionTitle title="Messages" subtitle="Discuss offers, documents and settlement steps with counterparties." />
      </Card>

      <Card>
        <p style={{ margin: 0, color: "#475569" }}>No conversations yet.</p>
        <p style={{ marginTop: 8, color: "#64748b" }}>
          Start by publishing a claim or investing in one to open a deal thread.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Link href="/claims/create">
            <button type="button">Create claim</button>
          </Link>
          <Link href="/marketplace">
            <button type="button" className="ghost">Browse marketplace</button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
