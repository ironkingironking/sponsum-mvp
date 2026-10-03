import { existsSync, readFileSync } from "node:fs";
import { MONIER_KIND, type FulfilmentSnapshot } from "./dispute-workbench.js";

const DEFAULT_PATHS = [
  process.env.MOVENA_FULFILMENT_CASE_PATH,
  "/opt/docker/movena-growth/data/fulfilment-cases.json",
  "/opt/docker/movena-growth/current/data/fulfilment-cases.json"
].filter(Boolean) as string[];

const CATEGORY_KIND: Record<string, (typeof MONIER_KIND)[keyof typeof MONIER_KIND]> = {
  incomplete: "nichterfuellung",
  quality: "schlechterfuellung",
  wrong: "schlechterfuellung",
  delay: "sonstige",
  access: "sonstige",
  other: "sonstige"
};

const CATEGORY_LABEL: Record<string, string> = {
  incomplete: "Nicht vollständig geliefert",
  quality: "Schlechte / mangelhafte Qualität",
  wrong: "Falsche Leistung / Abweichung vom Auftrag",
  delay: "Termin / Verzug",
  access: "Zugänge / Dokumentation fehlen",
  other: "Sonstiges"
};

export function fulfilmentStorePaths(env: NodeJS.ProcessEnv = process.env): string[] {
  const extra = env.MOVENA_FULFILMENT_CASE_PATH ? [env.MOVENA_FULFILMENT_CASE_PATH] : [];
  return [...new Set([...extra, ...DEFAULT_PATHS])];
}

export function loadFulfilmentCases(filePath?: string): unknown[] {
  const paths = filePath ? [filePath] : fulfilmentStorePaths();
  for (const file of paths) {
    if (!file || !existsSync(file)) continue;
    try {
      const raw = JSON.parse(readFileSync(file, "utf8")) as { cases?: Record<string, unknown> };
      const cases = raw?.cases && typeof raw.cases === "object" ? Object.values(raw.cases) : [];
      if (cases.length) return cases;
    } catch {
      continue;
    }
  }
  return [];
}

export function monitionFromAcceptance(acceptance: Record<string, unknown> | null | undefined): FulfilmentSnapshot["monition"] {
  if (!acceptance || typeof acceptance !== "object") {
    return { kind: "none", labels: [], comment: null, decision: null };
  }
  const decision = String(acceptance.decision || "");
  const categories = Array.isArray(acceptance.categories)
    ? acceptance.categories.map((row) => String(row))
    : [];
  const labels = categories.map((id) => CATEGORY_LABEL[id] || id);
  const comment = acceptance.comment ? String(acceptance.comment) : null;
  if (decision === "accepted" || !decision) {
    return { kind: "none", labels, comment, decision: decision || null };
  }
  const kinds = new Set(categories.map((id) => CATEGORY_KIND[id] || "sonstige"));
  const hasN = kinds.has("nichterfuellung");
  const hasS = kinds.has("schlechterfuellung");
  let kind: FulfilmentSnapshot["monition"]["kind"] = "sonstige";
  if (hasN && hasS) kind = "beides";
  else if (hasN) kind = "nichterfuellung";
  else if (hasS) kind = "schlechterfuellung";
  else if (decision === "rejected") kind = "nichterfuellung";
  else if (decision === "accepted_with_defects") kind = "schlechterfuellung";
  return { kind, labels, comment, decision };
}

export function scoreFulfilmentMatch(
  caseDoc: Record<string, unknown>,
  query: { invoiceId?: string; customer?: string; debtorId?: string; salesOrderId?: string }
): number {
  let score = 0;
  const invoice = (query.invoiceId || "").toLowerCase();
  const customer = (query.customer || "").toLowerCase();
  const debtor = (query.debtorId || "").toLowerCase();
  const so = (query.salesOrderId || "").toLowerCase();
  const blob = JSON.stringify(caseDoc).toLowerCase();
  if (invoice && blob.includes(invoice)) score += 8;
  if (so && String(caseDoc.sales_order_id || "").toLowerCase() === so) score += 10;
  const caseCustomer = String(caseDoc.customer || "").toLowerCase();
  if (customer && caseCustomer && (caseCustomer === customer || caseCustomer.includes(customer) || customer.includes(caseCustomer))) {
    score += 5;
  }
  if (debtor && blob.includes(debtor.replace(/^customer:|^debtor-/, ""))) score += 2;
  return score;
}

export function presentFulfilmentSnapshot(
  caseDoc: Record<string, unknown>,
  deskBase = "https://suite.movena.ch/growth/#/deals"
): FulfilmentSnapshot {
  const acceptance =
    caseDoc.acceptance && typeof caseDoc.acceptance === "object"
      ? (caseDoc.acceptance as Record<string, unknown>)
      : null;
  const monition = monitionFromAcceptance(acceptance);
  const items = Array.isArray(caseDoc.items) ? caseDoc.items : [];
  const required = items.filter((row) => row && typeof row === "object" && (row as { required?: boolean }).required);
  const done = required.filter((row) => {
    const status = String((row as { status?: string }).status || "");
    return status === "done" || status === "waived";
  });
  const dealId = caseDoc.deal_id ? String(caseDoc.deal_id) : "";
  return {
    id: String(caseDoc.id || ""),
    status: String(caseDoc.status || ""),
    disputed: Boolean(caseDoc.disputed) || String(caseDoc.status) === "disputed",
    billing_gate: caseDoc.billing_gate ? String(caseDoc.billing_gate) : null,
    customer: caseDoc.customer ? String(caseDoc.customer) : null,
    sales_order_id: caseDoc.sales_order_id ? String(caseDoc.sales_order_id) : null,
    quotation_id: caseDoc.quotation_id ? String(caseDoc.quotation_id) : null,
    profile: caseDoc.profile_label ? String(caseDoc.profile_label) : String(caseDoc.fulfilment_profile || ""),
    progress: { done: done.length, required: required.length },
    monition,
    desk_url: dealId ? `${deskBase.replace(/\/$/, "")}/${encodeURIComponent(dealId)}` : deskBase
  };
}

export function lookupFulfilmentBox(
  query: { invoiceId?: string; customer?: string; debtorId?: string; salesOrderId?: string },
  cases: unknown[] = loadFulfilmentCases()
): FulfilmentSnapshot | null {
  let best: { score: number; row: Record<string, unknown> } | null = null;
  for (const row of cases) {
    if (!row || typeof row !== "object") continue;
    const score = scoreFulfilmentMatch(row as Record<string, unknown>, query);
    if (score <= 0) continue;
    if (!best || score > best.score) best = { score, row: row as Record<string, unknown> };
  }
  return best ? presentFulfilmentSnapshot(best.row) : null;
}
