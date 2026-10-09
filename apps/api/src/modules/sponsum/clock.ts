/**
 * Today as the Swiss calendar day (Europe/Zurich), YYYY-MM-DD. Tests pin it with setSponsumToday so that
 * fixed maturity dates in fixtures stay «not overdue» regardless of the day the suite runs.
 */
let override: (() => string) | null = null;

export function setSponsumToday(fn: (() => string) | null): void {
  override = fn;
}

/** Runs fn with «today» pinned to day (the demo book tells a story as of its own date). */
export function withSponsumToday<T>(day: string, fn: () => T): T {
  const previous = override;
  override = () => day;
  try {
    return fn();
  } finally {
    override = previous;
  }
}

export function sponsumToday(now = new Date()): string {
  if (override) return override();
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Days past maturity (SPO-03); 0 when not yet due or when the receivable is settled, closed or sold on. */
export function overdueDays(asset: { maturity_date?: string | null; status: string }, today = sponsumToday()): number {
  if (!asset.maturity_date || ["PAID", "CLOSED", "TRANSFERRED", "FINANCED"].includes(asset.status)) return 0;
  const due = Date.parse(`${String(asset.maturity_date).slice(0, 10)}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(due) || !Number.isFinite(now)) return 0;
  return due < now ? Math.round((now - due) / 86400000) : 0;
}
