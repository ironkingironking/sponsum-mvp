import type { InstrumentType } from "@/lib/instruments";

export type DashboardRole = "investor" | "originator" | "operator" | "admin";

export type DashboardTab = "overview" | "instruments" | "risk" | "settlement" | "disputes" | "marketplace" | "admin";

export type DashboardPeriod = "7d" | "30d" | "90d";

export type SeverityLevel = "info" | "warning" | "critical";

export type PipelineStatus =
  | "draft"
  | "published"
  | "in_review"
  | "in_negotiation"
  | "pending_settlement"
  | "active"
  | "overdue"
  | "in_dispute"
  | "resolved"
  | "archived";

export type DashboardWidgetId =
  | "kpi_stat_cards"
  | "quick_actions"
  | "instrument_pipeline"
  | "risk_alerts"
  | "settlement_queue"
  | "dispute_queue"
  | "marketplace_performance"
  | "activity_feed"
  | "upcoming_deadlines"
  | "recent_instruments"
  | "counterparty_exposure"
  | "document_completeness";

export type WidgetSize = "sm" | "md" | "lg";

export type WidgetConfig = {
  id: DashboardWidgetId;
  title: string;
  allowedRoles: DashboardRole[];
  defaultSize: WidgetSize;
  priority: number;
  enabled: boolean;
  route: string;
  dataSourceKey: string;
  tabs: DashboardTab[];
};

export type DashboardFilters = {
  period: DashboardPeriod;
  instrumentType: InstrumentType | "all";
  status: PipelineStatus | "all";
  role: DashboardRole;
  onlyMine: boolean;
  onlyCritical: boolean;
};

export type DashboardInstrument = {
  id: string;
  title: string;
  type: InstrumentType;
  counterparty: string;
  nominalVolume: number;
  currency: string;
  maturityDate: string;
  status: PipelineStatus;
  riskLevel: SeverityLevel;
  riskScore: number;
  lastActivityAt: string;
  owner: string;
  isMine: boolean;
  publishedOffer: boolean;
  settlementPrepared: boolean;
  settlementMethod: "bank_transfer" | "escrow" | "custody_release";
  requiredDocumentCount: number;
  uploadedDocumentCount: number;
  missingSignatureCount: number;
  marketplaceViews: number;
  watchlistCount: number;
  inquiryCount: number;
  discountPercent: number;
  manualReviewFlag: boolean;
  counterpartyComplete: boolean;
};

export type ActivityFeedItem = {
  id: string;
  timestamp: string;
  actor: string;
  action:
    | "instrument_created"
    | "listing_published"
    | "document_uploaded"
    | "counterparty_validated"
    | "settlement_confirmed"
    | "dispute_opened"
    | "clause_updated";
  entityType: "instrument" | "listing" | "document" | "counterparty" | "settlement" | "dispute" | "clause";
  entityTitle: string;
  severity?: SeverityLevel;
};

export type SettlementQueueItem = {
  id: string;
  instrumentId: string;
  instrumentTitle: string;
  method: "bank_transfer" | "escrow" | "custody_release";
  dueDate: string;
  amount: number;
  currency: string;
  status: "pending" | "confirmed" | "partial";
  paymentEvidenceUploaded: boolean;
  nextAction: string;
};

export type DisputeQueueItem = {
  id: string;
  instrumentId: string;
  instrumentTitle: string;
  status: "open" | "under_review" | "mediation" | "arbitration" | "court" | "resolved";
  escalationStage: "stage_1" | "stage_2" | "stage_3";
  responseDueAt: string;
  amountInDispute: number;
  currency: string;
  documentationStatus: "complete" | "partial" | "missing";
  counterparty: string;
  owner: string;
};

export type RiskAlert = {
  id: string;
  severity: SeverityLevel;
  title: string;
  description: string;
  instrumentId?: string;
  instrumentTitle?: string;
  dueAt?: string;
  source:
    | "missing_documents"
    | "counterparty_incomplete"
    | "settlement_unprepared"
    | "overdue_payment"
    | "concentration_risk"
    | "manual_review";
};

export type QuickAction = {
  id: string;
  label: string;
  description: string;
  href: string;
  severity?: SeverityLevel;
};

export type KPIStat = {
  id: string;
  label: string;
  value: string;
  description: string;
  href: string;
  trend?: {
    direction: "up" | "down" | "flat";
    value: string;
  };
  severity?: SeverityLevel;
};

export type PipelineBucket = {
  status: PipelineStatus;
  count: number;
  totalVolume: number;
  currency: string;
};

export type CounterpartyExposure = {
  counterparty: string;
  instruments: number;
  exposureVolume: number;
  currency: string;
  riskLevel: SeverityLevel;
};

export type DocumentCompletenessItem = {
  instrumentId: string;
  instrumentTitle: string;
  requiredCount: number;
  uploadedCount: number;
  missingCount: number;
  missingSignatures: number;
  owner: string;
};

export type MarketplacePerformance = {
  publishedOffers: number;
  totalViews: number;
  watchlistAdds: number;
  contactConversionRate: number;
  avgDiscountPercent: number;
  demandByType: Array<{
    type: InstrumentType;
    demandScore: number;
  }>;
};

export type UpcomingDeadline = {
  id: string;
  title: string;
  kind: "maturity" | "settlement" | "dispute_response";
  dueDate: string;
  status: PipelineStatus | DisputeQueueItem["status"] | SettlementQueueItem["status"];
  owner: string;
};

export type DashboardDataSet = {
  instruments: DashboardInstrument[];
  activities: ActivityFeedItem[];
  settlements: SettlementQueueItem[];
  disputes: DisputeQueueItem[];
  quickActions: QuickAction[];
};

export type DashboardViewData = {
  kpis: KPIStat[];
  filteredInstruments: DashboardInstrument[];
  pipeline: PipelineBucket[];
  upcomingDeadlines: UpcomingDeadline[];
  riskAlerts: RiskAlert[];
  settlementQueue: SettlementQueueItem[];
  disputeQueue: DisputeQueueItem[];
  recentInstruments: DashboardInstrument[];
  activityFeed: ActivityFeedItem[];
  counterpartyExposure: CounterpartyExposure[];
  documentCompleteness: DocumentCompletenessItem[];
  marketplacePerformance: MarketplacePerformance;
  quickActions: QuickAction[];
};
