import { instrumentTypes } from "@/lib/instruments";
import type {
  DashboardFilters,
  DashboardRole,
  DashboardTab,
  DashboardWidgetId,
  PipelineStatus,
  WidgetConfig
} from "./dashboard-types";

export const dashboardTabs: Array<{ id: DashboardTab; label: string }> = [
  { id: "overview", label: "Übersicht" },
  { id: "instruments", label: "Instrumente" },
  { id: "risk", label: "Risiko" },
  { id: "settlement", label: "Settlement" },
  { id: "disputes", label: "Disputes" },
  { id: "marketplace", label: "Marketplace" },
  { id: "admin", label: "Admin" }
];

export const roleLabels: Record<DashboardRole, string> = {
  investor: "Investor",
  originator: "Originator",
  operator: "Operator",
  admin: "Admin"
};

export const pipelineStatusLabels: Record<PipelineStatus, string> = {
  draft: "Draft",
  published: "Published",
  in_review: "In Review",
  in_negotiation: "In Negotiation",
  pending_settlement: "Pending Settlement",
  active: "Active",
  overdue: "Overdue",
  in_dispute: "In Dispute",
  resolved: "Resolved",
  archived: "Archived"
};

export const widgetCatalog: WidgetConfig[] = [
  {
    id: "kpi_stat_cards",
    title: "KPI Overview",
    allowedRoles: ["investor", "originator", "operator", "admin"],
    defaultSize: "lg",
    priority: 1,
    enabled: true,
    route: "/dashboard",
    dataSourceKey: "kpis",
    tabs: ["overview", "instruments", "risk", "settlement", "disputes", "marketplace", "admin"]
  },
  {
    id: "quick_actions",
    title: "Quick Actions",
    allowedRoles: ["investor", "originator", "operator", "admin"],
    defaultSize: "md",
    priority: 2,
    enabled: true,
    route: "/dashboard",
    dataSourceKey: "quickActions",
    tabs: ["overview", "instruments"]
  },
  {
    id: "instrument_pipeline",
    title: "Instrument Pipeline",
    allowedRoles: ["originator", "operator", "admin"],
    defaultSize: "md",
    priority: 3,
    enabled: true,
    route: "/dashboard",
    dataSourceKey: "pipeline",
    tabs: ["overview", "instruments"]
  },
  {
    id: "risk_alerts",
    title: "Risk Alerts",
    allowedRoles: ["investor", "originator", "operator", "admin"],
    defaultSize: "md",
    priority: 4,
    enabled: true,
    route: "/dashboard?tab=risk",
    dataSourceKey: "riskAlerts",
    tabs: ["overview", "risk"]
  },
  {
    id: "claim_insights",
    title: "Claim Insights",
    allowedRoles: ["investor", "originator", "operator", "admin"],
    defaultSize: "md",
    priority: 5,
    enabled: true,
    route: "/dashboard?tab=disputes",
    dataSourceKey: "claimInsights",
    tabs: ["overview", "risk", "disputes", "admin"]
  },
  {
    id: "settlement_queue",
    title: "Settlement Queue",
    allowedRoles: ["originator", "operator", "admin"],
    defaultSize: "md",
    priority: 6,
    enabled: true,
    route: "/dashboard?tab=settlement",
    dataSourceKey: "settlementQueue",
    tabs: ["overview", "settlement"]
  },
  {
    id: "dispute_queue",
    title: "Dispute Queue",
    allowedRoles: ["originator", "operator", "admin"],
    defaultSize: "md",
    priority: 7,
    enabled: true,
    route: "/dashboard?tab=disputes",
    dataSourceKey: "disputeQueue",
    tabs: ["overview", "disputes"]
  },
  {
    id: "marketplace_performance",
    title: "Marketplace Performance",
    allowedRoles: ["investor", "originator", "admin"],
    defaultSize: "md",
    priority: 8,
    enabled: true,
    route: "/dashboard?tab=marketplace",
    dataSourceKey: "marketplacePerformance",
    tabs: ["overview", "marketplace"]
  },
  {
    id: "activity_feed",
    title: "Activity Feed",
    allowedRoles: ["investor", "originator", "operator", "admin"],
    defaultSize: "md",
    priority: 9,
    enabled: true,
    route: "/dashboard",
    dataSourceKey: "activityFeed",
    tabs: ["overview", "admin"]
  },
  {
    id: "upcoming_deadlines",
    title: "Upcoming Deadlines",
    allowedRoles: ["investor", "originator", "operator", "admin"],
    defaultSize: "md",
    priority: 10,
    enabled: true,
    route: "/dashboard?tab=settlement",
    dataSourceKey: "upcomingDeadlines",
    tabs: ["overview", "settlement"]
  },
  {
    id: "recent_instruments",
    title: "Recent Instruments",
    allowedRoles: ["investor", "originator", "operator", "admin"],
    defaultSize: "lg",
    priority: 11,
    enabled: true,
    route: "/dashboard?tab=instruments",
    dataSourceKey: "recentInstruments",
    tabs: ["overview", "instruments"]
  },
  {
    id: "counterparty_exposure",
    title: "Counterparty Exposure",
    allowedRoles: ["investor", "originator", "admin"],
    defaultSize: "md",
    priority: 12,
    enabled: true,
    route: "/dashboard?tab=risk",
    dataSourceKey: "counterpartyExposure",
    tabs: ["overview", "risk"]
  },
  {
    id: "document_completeness",
    title: "Document Completeness",
    allowedRoles: ["originator", "operator", "admin"],
    defaultSize: "md",
    priority: 13,
    enabled: true,
    route: "/dashboard?tab=risk",
    dataSourceKey: "documentCompleteness",
    tabs: ["overview", "risk", "admin"]
  }
];

export const defaultDashboardFilters: DashboardFilters = {
  period: "30d",
  instrumentType: "all",
  status: "all",
  role: "originator",
  onlyMine: false,
  onlyCritical: false
};

export function getWidgetsForRole(role: DashboardRole, tab: DashboardTab): WidgetConfig[] {
  return widgetCatalog
    .filter((widget) => widget.enabled)
    .filter((widget) => widget.allowedRoles.includes(role))
    .filter((widget) => widget.tabs.includes(tab))
    .sort((left, right) => left.priority - right.priority);
}

export const filterOptions = {
  periods: [
    { value: "7d", label: "7 Tage" },
    { value: "30d", label: "30 Tage" },
    { value: "90d", label: "90 Tage" }
  ],
  statuses: [
    { value: "all", label: "Alle Status" },
    { value: "draft", label: "Draft" },
    { value: "published", label: "Published" },
    { value: "in_review", label: "In Review" },
    { value: "in_negotiation", label: "In Negotiation" },
    { value: "pending_settlement", label: "Pending Settlement" },
    { value: "active", label: "Active" },
    { value: "overdue", label: "Overdue" },
    { value: "in_dispute", label: "In Dispute" },
    { value: "resolved", label: "Resolved" },
    { value: "archived", label: "Archived" }
  ],
  instrumentTypes: [{ value: "all", label: "Alle Typen" }, ...instrumentTypes.map((type) => ({ value: type, label: type }))]
};

export const widgetPlacementOrder: DashboardWidgetId[] = widgetCatalog.map((widget) => widget.id);
