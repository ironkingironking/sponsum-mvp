"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, SectionTitle } from "@sponsum/ui";
import {
  ClaimInsightsWidget,
  RecentInstrumentsTable,
  RiskAlertsWidget,
  SettlementQueueWidget,
  UpcomingDeadlinesWidget
} from "@/components/dashboard";
import {
  buildDashboardViewData,
  defaultDashboardFilters,
  formatCurrency,
  type DashboardFilters,
  type DashboardRole
} from "@/lib/dashboard";

function summaryCountLabel(value: number): string {
  return new Intl.NumberFormat("de-CH").format(value);
}

export default function DashboardPage() {
  const [filters, setFilters] = useState<DashboardFilters>(defaultDashboardFilters);
  const viewData = useMemo(() => buildDashboardViewData(filters), [filters]);

  const myClaims = viewData.filteredInstruments.filter((item) => item.isMine);
  const pendingSettlements = viewData.settlementQueue.filter((item) => item.status !== "confirmed");
  const estimatedInvestments = viewData.filteredInstruments.filter((item) => !item.isMine);

  const recentMarketplaceActivity = viewData.activityFeed
    .filter((entry) => entry.entityType === "listing" || entry.entityType === "instrument" || entry.entityType === "settlement")
    .slice(0, 6);

  return (
    <div className="container dashboard-shell">
      <Card>
        <SectionTitle title="Dashboard" subtitle="Everything important at a glance: create, invest and track settlement." />
        <div className="dashboard-filter-compact">
          <label>
            Role
            <select
              value={filters.role}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  role: event.target.value as DashboardRole
                }))
              }
            >
              <option value="originator">Originator</option>
              <option value="investor">Investor</option>
              <option value="operator">Operator</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label>
            Period
            <select
              value={filters.period}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  period: event.target.value as DashboardFilters["period"]
                }))
              }
            >
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
              <option value="90d">90 days</option>
            </select>
          </label>
          <label className="inline-control">
            <input
              type="checkbox"
              checked={filters.onlyCritical}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  onlyCritical: event.target.checked
                }))
              }
            />
            Show only critical items
          </label>
        </div>
      </Card>

      <section>
        <h3 className="section-eyebrow">Main Actions</h3>
        <div className="primary-action-grid">
          <Link href="/claims/create" className="primary-action-card">
            <strong>Create Claim</strong>
            <p>Create and publish a new deal in 4 simple steps.</p>
          </Link>
          <Link href="/marketplace" className="primary-action-card">
            <strong>Invest in Claim</strong>
            <p>Browse claim cards and compare risk, trust and return.</p>
          </Link>
          <Link href="/deals" className="primary-action-card">
            <strong>Track Settlement</strong>
            <p>See what is pending, due or already settled.</p>
          </Link>
        </div>
      </section>

      <section>
        <h3 className="section-eyebrow">My Activity</h3>
        <div className="grid grid-3">
          <Card>
            <p className="summary-label">Claims created</p>
            <p className="summary-value">{summaryCountLabel(myClaims.length)}</p>
          </Card>
          <Card>
            <p className="summary-label">Investments</p>
            <p className="summary-value">{summaryCountLabel(estimatedInvestments.length)}</p>
          </Card>
          <Card>
            <p className="summary-label">Pending settlements</p>
            <p className="summary-value">{summaryCountLabel(pendingSettlements.length)}</p>
          </Card>
        </div>
      </section>

      <section>
        <h3 className="section-eyebrow">Quick Actions</h3>
        <div className="grid grid-2">
          <Card>
            <strong>Create Claim</strong>
            <p style={{ color: "#64748b" }}>Start a new deal and publish to investors.</p>
            <Link href="/claims/create">
              <button type="button">Open wizard</button>
            </Link>
          </Card>
          <Card>
            <strong>Browse Marketplace</strong>
            <p style={{ color: "#64748b" }}>Find claims by return, risk and trust profile.</p>
            <Link href="/marketplace">
              <button type="button">Browse deals</button>
            </Link>
          </Card>
        </div>
      </section>

      <section>
        <h3 className="section-eyebrow">Recent Marketplace Activity</h3>
        <Card>
          {recentMarketplaceActivity.length === 0 ? (
            <div className="empty-hint">
              <p>You have no marketplace activity yet.</p>
              <Link href="/marketplace">
                <button type="button">Browse marketplace</button>
              </Link>
            </div>
          ) : (
            <div className="dashboard-list">
              {recentMarketplaceActivity.map((item) => (
                <div key={item.id} className="dashboard-list-item">
                  <div>
                    <strong>{item.entityTitle}</strong>
                    <p>
                      {item.action.replaceAll("_", " ")} · {new Date(item.timestamp).toLocaleString("de-CH")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="grid grid-2">
        <UpcomingDeadlinesWidget items={viewData.upcomingDeadlines} />
        <SettlementQueueWidget items={viewData.settlementQueue} />
      </section>

      <section className="grid grid-2">
        <RiskAlertsWidget alerts={viewData.riskAlerts} />
        <ClaimInsightsWidget insights={viewData.claimInsights} />
      </section>

      <Card>
        <SectionTitle
          title="Recent Deals"
          subtitle={`Pipeline volume: ${formatCurrency(viewData.filteredInstruments.reduce((acc, item) => acc + item.nominalVolume, 0), "CHF")}`}
        />
        <RecentInstrumentsTable instruments={viewData.recentInstruments} />
      </Card>
    </div>
  );
}

