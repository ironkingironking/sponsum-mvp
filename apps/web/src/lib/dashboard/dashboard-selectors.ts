import { dashboardMockData } from "./dashboard-mocks";
import { formatCurrency, formatNumber } from "./dashboard-formatters";
import type {
  CounterpartyExposure,
  DashboardDataSet,
  DashboardFilters,
  DashboardInstrument,
  DashboardViewData,
  DisputeQueueItem,
  KPIStat,
  PipelineBucket,
  PipelineStatus,
  RiskAlert,
  SettlementQueueItem,
  UpcomingDeadline
} from "./dashboard-types";

const allPipelineStatuses: PipelineStatus[] = [
  "draft",
  "published",
  "in_review",
  "in_negotiation",
  "pending_settlement",
  "active",
  "overdue",
  "in_dispute",
  "resolved",
  "archived"
];

function periodToDays(period: DashboardFilters["period"]): number {
  if (period === "7d") return 7;
  if (period === "30d") return 30;
  return 90;
}

function isCriticalInstrument(instrument: DashboardInstrument): boolean {
  const missingDocs = instrument.requiredDocumentCount - instrument.uploadedDocumentCount > 0;
  const dueSoon = new Date(instrument.maturityDate).getTime() - Date.now() <= 7 * 24 * 60 * 60 * 1000;
  return (
    instrument.riskLevel === "critical" ||
    instrument.status === "overdue" ||
    instrument.status === "in_dispute" ||
    instrument.manualReviewFlag ||
    (dueSoon && !instrument.settlementPrepared) ||
    missingDocs
  );
}

export function filterDashboardInstruments(
  instruments: DashboardInstrument[],
  filters: DashboardFilters,
  now = new Date()
): DashboardInstrument[] {
  const days = periodToDays(filters.period);
  const minTimestamp = now.getTime() - days * 24 * 60 * 60 * 1000;

  return instruments
    .filter((instrument) => {
      if (filters.instrumentType !== "all" && instrument.type !== filters.instrumentType) return false;
      if (filters.status !== "all" && instrument.status !== filters.status) return false;
      if (filters.onlyMine && !instrument.isMine) return false;
      if (filters.onlyCritical && !isCriticalInstrument(instrument)) return false;
      return new Date(instrument.lastActivityAt).getTime() >= minTimestamp;
    })
    .sort((left, right) => new Date(right.lastActivityAt).getTime() - new Date(left.lastActivityAt).getTime());
}

function buildKpis(
  instruments: DashboardInstrument[],
  disputes: DisputeQueueItem[],
  settlements: SettlementQueueItem[],
  now = new Date()
): KPIStat[] {
  const upcoming7d = now.getTime() + 7 * 24 * 60 * 60 * 1000;
  const activeStatuses: PipelineStatus[] = [
    "published",
    "in_review",
    "in_negotiation",
    "pending_settlement",
    "active",
    "overdue",
    "in_dispute"
  ];

  const active = instruments.filter((item) => activeStatuses.includes(item.status)).length;
  const publishedOffers = instruments.filter((item) => item.publishedOffer).length;
  const dueSoon = instruments.filter((item) => {
    const due = new Date(item.maturityDate).getTime();
    return due >= now.getTime() && due <= upcoming7d && !["resolved", "archived"].includes(item.status);
  }).length;
  const overdue = instruments.filter((item) => item.status === "overdue").length;
  const openDisputes = disputes.filter((item) => item.status !== "resolved").length;
  const pendingSignatures = instruments.reduce((sum, item) => sum + item.missingSignatureCount, 0);
  const missingDocs = instruments.filter(
    (item) => item.uploadedDocumentCount < item.requiredDocumentCount || item.missingSignatureCount > 0
  ).length;
  const nominalVolume = instruments.reduce((sum, item) => sum + item.nominalVolume, 0);
  const pendingSettlements = settlements.filter((item) => item.status !== "confirmed").length;

  return [
    {
      id: "active_instruments",
      label: "Aktive Instrumente",
      value: formatNumber(active),
      description: "Pipeline in operativer Bearbeitung",
      href: "/dashboard?tab=instruments"
    },
    {
      id: "published_offers",
      label: "Publizierte Angebote",
      value: formatNumber(publishedOffers),
      description: "Aktive Offers auf dem Marketplace",
      href: "/marketplace",
      trend: { direction: "up", value: "+6.8%" }
    },
    {
      id: "due_in_7_days",
      label: "Faellig in 7 Tagen",
      value: formatNumber(dueSoon),
      description: "Baldige Faelligkeiten",
      href: "/dashboard?tab=settlement",
      severity: dueSoon > 4 ? "warning" : "info"
    },
    {
      id: "overdue",
      label: "Ueberfaellig",
      value: formatNumber(overdue),
      description: "Instrumente ausserhalb Frist",
      href: "/dashboard?tab=settlement",
      severity: overdue > 0 ? "critical" : "info"
    },
    {
      id: "open_disputes",
      label: "Offene Disputes",
      value: formatNumber(openDisputes),
      description: "Streitfaelle in Bearbeitung",
      href: "/dashboard?tab=disputes",
      severity: openDisputes > 1 ? "warning" : "info"
    },
    {
      id: "pending_signatures",
      label: "Ausstehende Signaturen",
      value: formatNumber(pendingSignatures),
      description: "Fehlende Signoffs in Dokumentset",
      href: "/dashboard?tab=risk",
      severity: pendingSignatures > 0 ? "warning" : "info"
    },
    {
      id: "missing_documents",
      label: "Fehlende Pflichtdokumente",
      value: formatNumber(missingDocs),
      description: "Instrumente mit Luecken",
      href: "/dashboard?tab=risk",
      severity: missingDocs > 0 ? "critical" : "info"
    },
    {
      id: "nominal_volume",
      label: "Gesamtvolumen",
      value: formatCurrency(nominalVolume, "CHF"),
      description: "Nominalvolumen der gefilterten Pipeline",
      href: "/dashboard?tab=instruments"
    },
    {
      id: "pending_settlements",
      label: "Settlement Queue",
      value: formatNumber(pendingSettlements),
      description: "Pending/Partial Settlements",
      href: "/dashboard?tab=settlement",
      severity: pendingSettlements > 2 ? "warning" : "info"
    }
  ];
}

function buildPipeline(instruments: DashboardInstrument[]): PipelineBucket[] {
  return allPipelineStatuses.map((status) => {
    const entries = instruments.filter((item) => item.status === status);
    const totalVolume = entries.reduce((sum, item) => sum + item.nominalVolume, 0);
    return {
      status,
      count: entries.length,
      totalVolume,
      currency: "CHF"
    };
  });
}

function buildUpcomingDeadlines(
  instruments: DashboardInstrument[],
  settlements: SettlementQueueItem[],
  disputes: DisputeQueueItem[],
  now = new Date()
): UpcomingDeadline[] {
  const maxDate = now.getTime() + 14 * 24 * 60 * 60 * 1000;
  const deadlines: UpcomingDeadline[] = [];

  for (const instrument of instruments) {
    const due = new Date(instrument.maturityDate).getTime();
    if (due <= maxDate) {
      deadlines.push({
        id: `dl-inst-${instrument.id}`,
        title: instrument.title,
        kind: "maturity",
        dueDate: instrument.maturityDate,
        status: instrument.status,
        owner: instrument.owner
      });
    }
  }

  for (const settlement of settlements) {
    const due = new Date(settlement.dueDate).getTime();
    if (due <= maxDate) {
      deadlines.push({
        id: `dl-set-${settlement.id}`,
        title: settlement.instrumentTitle,
        kind: "settlement",
        dueDate: settlement.dueDate,
        status: settlement.status,
        owner: settlement.nextAction
      });
    }
  }

  for (const dispute of disputes) {
    const due = new Date(dispute.responseDueAt).getTime();
    if (due <= maxDate) {
      deadlines.push({
        id: `dl-dis-${dispute.id}`,
        title: dispute.instrumentTitle,
        kind: "dispute_response",
        dueDate: dispute.responseDueAt,
        status: dispute.status,
        owner: dispute.owner
      });
    }
  }

  return deadlines
    .sort((left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime())
    .slice(0, 12);
}

function buildRiskAlerts(
  instruments: DashboardInstrument[],
  disputes: DisputeQueueItem[],
  settlements: SettlementQueueItem[],
  now = new Date()
): RiskAlert[] {
  const alerts: RiskAlert[] = [];
  const upcoming7d = now.getTime() + 7 * 24 * 60 * 60 * 1000;

  for (const instrument of instruments) {
    const missingDocs = instrument.requiredDocumentCount - instrument.uploadedDocumentCount;
    const due = new Date(instrument.maturityDate).getTime();

    if (missingDocs > 0) {
      alerts.push({
        id: `ra-doc-${instrument.id}`,
        severity: missingDocs > 2 ? "critical" : "warning",
        title: "Missing required documents",
        description: `${missingDocs} Pflichtdokument(e) fehlen`,
        instrumentId: instrument.id,
        instrumentTitle: instrument.title,
        dueAt: instrument.maturityDate,
        source: "missing_documents"
      });
    }

    if (!instrument.counterpartyComplete) {
      alerts.push({
        id: `ra-cp-${instrument.id}`,
        severity: "warning",
        title: "Counterparty incomplete",
        description: "KYC/Counterparty Daten nicht vollstaendig",
        instrumentId: instrument.id,
        instrumentTitle: instrument.title,
        source: "counterparty_incomplete"
      });
    }

    if (due <= upcoming7d && due >= now.getTime() && !instrument.settlementPrepared) {
      alerts.push({
        id: `ra-set-${instrument.id}`,
        severity: "critical",
        title: "Settlement not prepared",
        description: "Faelligkeit innerhalb 7 Tage ohne Settlement Prep",
        instrumentId: instrument.id,
        instrumentTitle: instrument.title,
        dueAt: instrument.maturityDate,
        source: "settlement_unprepared"
      });
    }

    if (instrument.status === "overdue") {
      alerts.push({
        id: `ra-over-${instrument.id}`,
        severity: "critical",
        title: "Overdue payment",
        description: "Instrument ist ueberfaellig",
        instrumentId: instrument.id,
        instrumentTitle: instrument.title,
        dueAt: instrument.maturityDate,
        source: "overdue_payment"
      });
    }

    if (instrument.manualReviewFlag) {
      alerts.push({
        id: `ra-manual-${instrument.id}`,
        severity: "warning",
        title: "Manual review flag",
        description: "Ungewoehnliche Parameter / manuelle Pruefung noetig",
        instrumentId: instrument.id,
        instrumentTitle: instrument.title,
        source: "manual_review"
      });
    }
  }

  const totalVolume = instruments.reduce((sum, item) => sum + item.nominalVolume, 0);
  const exposure = new Map<string, number>();
  for (const instrument of instruments) {
    exposure.set(instrument.counterparty, (exposure.get(instrument.counterparty) || 0) + instrument.nominalVolume);
  }

  for (const [counterparty, volume] of exposure.entries()) {
    const share = totalVolume > 0 ? volume / totalVolume : 0;
    if (share >= 0.28) {
      alerts.push({
        id: `ra-concentration-${counterparty}`,
        severity: share >= 0.35 ? "critical" : "warning",
        title: "Counterparty concentration",
        description: `${counterparty} ist mit ${(share * 100).toFixed(1)}% konzentriert`,
        source: "concentration_risk"
      });
    }
  }

  for (const settlement of settlements) {
    if (settlement.status !== "confirmed" && !settlement.paymentEvidenceUploaded) {
      alerts.push({
        id: `ra-set-evidence-${settlement.id}`,
        severity: "warning",
        title: "Missing payment evidence",
        description: `Settlement Evidence fehlt fuer ${settlement.instrumentTitle}`,
        instrumentId: settlement.instrumentId,
        instrumentTitle: settlement.instrumentTitle,
        dueAt: settlement.dueDate,
        source: "missing_documents"
      });
    }
  }

  for (const dispute of disputes) {
    if (dispute.documentationStatus !== "complete") {
      alerts.push({
        id: `ra-dispute-doc-${dispute.id}`,
        severity: dispute.documentationStatus === "missing" ? "critical" : "warning",
        title: "Dispute documentation gap",
        description: `Dokumentenlage ${dispute.documentationStatus} fuer ${dispute.instrumentTitle}`,
        instrumentId: dispute.instrumentId,
        instrumentTitle: dispute.instrumentTitle,
        dueAt: dispute.responseDueAt,
        source: "missing_documents"
      });
    }
  }

  return alerts.slice(0, 20);
}

function buildCounterpartyExposure(instruments: DashboardInstrument[]): CounterpartyExposure[] {
  const byCounterparty = new Map<string, CounterpartyExposure>();

  for (const instrument of instruments) {
    const current = byCounterparty.get(instrument.counterparty);
    if (!current) {
      byCounterparty.set(instrument.counterparty, {
        counterparty: instrument.counterparty,
        instruments: 1,
        exposureVolume: instrument.nominalVolume,
        currency: "CHF",
        riskLevel: instrument.riskLevel
      });
      continue;
    }

    current.instruments += 1;
    current.exposureVolume += instrument.nominalVolume;
    if (instrument.riskLevel === "critical" || (instrument.riskLevel === "warning" && current.riskLevel === "info")) {
      current.riskLevel = instrument.riskLevel;
    }
  }

  return Array.from(byCounterparty.values())
    .sort((left, right) => right.exposureVolume - left.exposureVolume)
    .slice(0, 8);
}

function buildDocumentCompleteness(instruments: DashboardInstrument[]) {
  return instruments
    .map((instrument) => {
      const missingCount = Math.max(instrument.requiredDocumentCount - instrument.uploadedDocumentCount, 0);
      return {
        instrumentId: instrument.id,
        instrumentTitle: instrument.title,
        requiredCount: instrument.requiredDocumentCount,
        uploadedCount: instrument.uploadedDocumentCount,
        missingCount,
        missingSignatures: instrument.missingSignatureCount,
        owner: instrument.owner
      };
    })
    .filter((item) => item.missingCount > 0 || item.missingSignatures > 0)
    .sort((left, right) => right.missingCount + right.missingSignatures - (left.missingCount + left.missingSignatures))
    .slice(0, 10);
}

function buildMarketplacePerformance(instruments: DashboardInstrument[]) {
  const published = instruments.filter((item) => item.publishedOffer);
  const totalViews = published.reduce((sum, item) => sum + item.marketplaceViews, 0);
  const watchlistAdds = published.reduce((sum, item) => sum + item.watchlistCount, 0);
  const inquiries = published.reduce((sum, item) => sum + item.inquiryCount, 0);
  const avgDiscountPercent =
    published.length > 0 ? published.reduce((sum, item) => sum + item.discountPercent, 0) / published.length : 0;

  const demandMap = new Map<string, number>();
  for (const item of published) {
    demandMap.set(item.type, (demandMap.get(item.type) || 0) + item.watchlistCount + item.inquiryCount * 2);
  }

  const demandByType = Array.from(demandMap.entries())
    .map(([type, demandScore]) => ({ type: type as DashboardInstrument["type"], demandScore }))
    .sort((left, right) => right.demandScore - left.demandScore)
    .slice(0, 6);

  const conversion = totalViews > 0 ? (inquiries / totalViews) * 100 : 0;

  return {
    publishedOffers: published.length,
    totalViews,
    watchlistAdds,
    contactConversionRate: conversion,
    avgDiscountPercent,
    demandByType
  };
}

function filterSettlementQueue(
  settlements: SettlementQueueItem[],
  instrumentsById: Map<string, DashboardInstrument>,
  filters: DashboardFilters
) {
  return settlements.filter((item) => {
    const instrument = instrumentsById.get(item.instrumentId);
    if (!instrument) return false;
    if (filters.onlyMine && !instrument.isMine) return false;
    if (filters.onlyCritical && item.status === "confirmed" && item.paymentEvidenceUploaded) return false;
    return true;
  });
}

function filterDisputeQueue(
  disputes: DisputeQueueItem[],
  instrumentsById: Map<string, DashboardInstrument>,
  filters: DashboardFilters
) {
  return disputes.filter((item) => {
    const instrument = instrumentsById.get(item.instrumentId);
    if (!instrument) return false;
    if (filters.onlyMine && !instrument.isMine) return false;
    if (filters.onlyCritical && item.status === "resolved") return false;
    return true;
  });
}

export function buildDashboardViewData(
  filters: DashboardFilters,
  data: DashboardDataSet = dashboardMockData,
  now = new Date()
): DashboardViewData {
  const filteredInstruments = filterDashboardInstruments(data.instruments, filters, now);
  const instrumentsById = new Map(filteredInstruments.map((item) => [item.id, item]));
  const settlementQueue = filterSettlementQueue(data.settlements, instrumentsById, filters);
  const disputeQueue = filterDisputeQueue(data.disputes, instrumentsById, filters);
  const riskAlerts = buildRiskAlerts(filteredInstruments, disputeQueue, settlementQueue, now);
  const filteredActivities = data.activities
    .filter((activity) => {
      if (!filters.onlyCritical) return true;
      return activity.severity === "warning" || activity.severity === "critical";
    })
    .slice(0, 20);

  const upcomingDeadlines = buildUpcomingDeadlines(filteredInstruments, settlementQueue, disputeQueue, now);
  const counterpartyExposure = buildCounterpartyExposure(filteredInstruments);
  const documentCompleteness = buildDocumentCompleteness(filteredInstruments);
  const marketplacePerformance = buildMarketplacePerformance(filteredInstruments);
  const pipeline = buildPipeline(filteredInstruments);
  const recentInstruments = filteredInstruments.slice(0, 12);

  const kpis = buildKpis(filteredInstruments, disputeQueue, settlementQueue, now);

  const quickActions = filters.onlyCritical
    ? data.quickActions.filter((action) => action.severity === "warning" || action.severity === "critical")
    : data.quickActions;

  return {
    kpis,
    filteredInstruments,
    pipeline,
    upcomingDeadlines,
    riskAlerts,
    settlementQueue,
    disputeQueue,
    recentInstruments,
    activityFeed: filteredActivities,
    counterpartyExposure,
    documentCompleteness,
    marketplacePerformance,
    quickActions
  };
}

export function sumNominalVolume(instruments: DashboardInstrument[]): string {
  const amount = instruments.reduce((sum, item) => sum + item.nominalVolume, 0);
  return formatCurrency(amount, "CHF");
}

export function pipelineStatusLabel(status: PipelineStatus): string {
  const labelMap: Record<PipelineStatus, string> = {
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

  return labelMap[status];
}
