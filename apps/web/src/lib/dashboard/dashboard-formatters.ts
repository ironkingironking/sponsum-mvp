import type { SeverityLevel } from "./dashboard-types";

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("de-CH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("de-CH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("de-CH").format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatRelativeDays(value: string, now = new Date()): string {
  const deltaMs = new Date(value).getTime() - now.getTime();
  const deltaDays = Math.ceil(deltaMs / (1000 * 60 * 60 * 24));

  if (deltaDays < 0) {
    return `${Math.abs(deltaDays)} Tage überfällig`;
  }

  if (deltaDays === 0) {
    return "Heute";
  }

  if (deltaDays === 1) {
    return "Morgen";
  }

  return `In ${deltaDays} Tagen`;
}

export function severityToColor(level: SeverityLevel): string {
  if (level === "critical") {
    return "#b91c1c";
  }
  if (level === "warning") {
    return "#b45309";
  }
  return "#1d4ed8";
}

export function trendToSymbol(direction: "up" | "down" | "flat"): string {
  if (direction === "up") {
    return "^";
  }
  if (direction === "down") {
    return "v";
  }
  return "=";
}
