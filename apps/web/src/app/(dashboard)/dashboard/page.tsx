"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ActivityFeed,
  ClaimInsightsWidget,
  CounterpartyExposureWidget,
  DashboardGrid,
  DashboardHeader,
  DashboardTabs,
  DisputeQueueWidget,
  DocumentCompletenessWidget,
  InstrumentPipelineWidget,
  KPIStatCards,
  MarketplacePerformanceWidget,
  QuickActionsPanel,
  RecentInstrumentsTable,
  RiskAlertsWidget,
  SettlementQueueWidget,
  UpcomingDeadlinesWidget
} from "@/components/dashboard";
import {
  buildDashboardViewData,
  dashboardTabs,
  defaultDashboardFilters,
  getWidgetsForRole,
  type DashboardRole,
  type DashboardTab,
  type DashboardWidgetId,
  type WidgetConfig
} from "@/lib/dashboard";

function renderDashboardWidget(widgetId: DashboardWidgetId, data: ReturnType<typeof buildDashboardViewData>) {
  const widgets: Record<DashboardWidgetId, ReactNode> = {
    kpi_stat_cards: <KPIStatCards items={data.kpis} />,
    quick_actions: <QuickActionsPanel actions={data.quickActions} />,
    instrument_pipeline: <InstrumentPipelineWidget buckets={data.pipeline} />,
    risk_alerts: <RiskAlertsWidget alerts={data.riskAlerts} />,
    claim_insights: <ClaimInsightsWidget insights={data.claimInsights} />,
    settlement_queue: <SettlementQueueWidget items={data.settlementQueue} />,
    dispute_queue: <DisputeQueueWidget items={data.disputeQueue} />,
    marketplace_performance: <MarketplacePerformanceWidget metrics={data.marketplacePerformance} />,
    activity_feed: <ActivityFeed items={data.activityFeed} />,
    upcoming_deadlines: <UpcomingDeadlinesWidget items={data.upcomingDeadlines} />,
    recent_instruments: <RecentInstrumentsTable instruments={data.recentInstruments} />,
    counterparty_exposure: <CounterpartyExposureWidget exposures={data.counterpartyExposure} />,
    document_completeness: <DocumentCompletenessWidget items={data.documentCompleteness} />
  };

  return widgets[widgetId];
}

export default function DashboardPage() {
  const [role, setRole] = useState<DashboardRole>(defaultDashboardFilters.role);
  const [tab, setTab] = useState<DashboardTab>("overview");
  const [filters, setFilters] = useState({
    ...defaultDashboardFilters,
    role
  });

  const viewData = useMemo(() => buildDashboardViewData(filters), [filters]);
  const widgets = useMemo(() => getWidgetsForRole(role, tab), [role, tab]);

  const gridWidgets = useMemo(
    () => widgets.filter((widget) => widget.id !== "kpi_stat_cards"),
    [widgets]
  );

  function onRoleChange(nextRole: DashboardRole) {
    setRole(nextRole);
    setFilters((current) => ({
      ...current,
      role: nextRole
    }));
  }

  function renderWidget(widget: WidgetConfig) {
    return renderDashboardWidget(widget.id, viewData);
  }

  return (
    <div className="dashboard-shell">
      <DashboardHeader role={role} filters={filters} onRoleChange={onRoleChange} onFiltersChange={setFilters} />

      <DashboardTabs tabs={dashboardTabs} activeTab={tab} onChange={setTab} />

      <KPIStatCards items={viewData.kpis} />

      {viewData.filteredInstruments.length === 0 ? (
        <div className="dashboard-empty-state">
          <h3>Keine Daten für diesen Filter</h3>
          <p>Bitte Zeitraum, Rolle oder Statusfilter anpassen.</p>
        </div>
      ) : (
        <DashboardGrid widgets={gridWidgets} renderWidget={renderWidget} />
      )}
    </div>
  );
}
