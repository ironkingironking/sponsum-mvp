import Link from "next/link";
import { Card, SectionTitle } from "@sponsum/ui";
import { apiGet } from "@/lib/api";

type DealItem = {
  id: string;
  title: string;
  amount: string;
  currency: string;
  maturityDate: string;
  status: string;
  settlementEvents?: Array<{ id: string; eventType: string; status: string }>;
};

function timelineStep(status: string): number {
  const normalized = status.toUpperCase();
  if (normalized === "DRAFT") return 1;
  if (normalized === "ISSUED" || normalized === "PUBLISHED") return 2;
  if (normalized === "ACTIVE" || normalized === "PARTIALLY_SETTLED") return 3;
  if (normalized === "OVERDUE" || normalized === "DEFAULTED") return 4;
  if (normalized === "SETTLED" || normalized === "RESOLVED") return 5;
  return 2;
}

function toAmount(value: string): string {
  const number = Number(value);
  if (Number.isNaN(number)) {
    return value;
  }
  return new Intl.NumberFormat("de-CH", { maximumFractionDigits: 0 }).format(number);
}

export default async function MyDealsPage() {
  const deals = await apiGet<DealItem[]>("/claims").catch(() => []);
  const pendingSettlement = deals.filter((deal) => deal.status !== "SETTLED" && deal.status !== "RESOLVED");

  return (
    <div className="container grid" style={{ gap: 16 }}>
      <Card>
        <SectionTitle title="My Deals" subtitle="Track settlement progress and open actions across your deals." />
      </Card>

      <div className="grid grid-3">
        <Card>
          <p className="summary-label">Claims created</p>
          <p className="summary-value">{deals.length}</p>
        </Card>
        <Card>
          <p className="summary-label">Pending settlements</p>
          <p className="summary-value">{pendingSettlement.length}</p>
        </Card>
        <Card>
          <p className="summary-label">Resolved deals</p>
          <p className="summary-value">{deals.filter((deal) => deal.status === "SETTLED" || deal.status === "RESOLVED").length}</p>
        </Card>
      </div>

      {deals.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: "#475569" }}>You have not created any claims yet.</p>
          <div style={{ marginTop: 10 }}>
            <Link href="/claims/create">
              <button type="button">Create your first claim</button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid" style={{ gap: 10 }}>
          {deals.map((deal) => (
            <Card key={deal.id}>
              <div className="deal-row">
                <div>
                  <strong>{deal.title}</strong>
                  <p style={{ margin: "4px 0 0", color: "#64748b" }}>
                    {toAmount(deal.amount)} {deal.currency} · Due {new Date(deal.maturityDate).toLocaleDateString("de-CH")}
                  </p>
                </div>
                <div className="deal-row-right">
                  <span className="status-pill">{deal.status}</span>
                  <Link href={`/claims/${deal.id}`} className="dashboard-widget-link">
                    View details
                  </Link>
                </div>
              </div>

              <div className="deal-timeline" style={{ marginTop: 12 }}>
                {["Created", "Funded", "Active", "Due", "Settled"].map((label, index) => (
                  <div key={label} className={timelineStep(deal.status) >= index + 1 ? "active" : ""}>
                    {label}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
