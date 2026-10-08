/**
 * Signed settlement webhooks (audit DK-31, 2026-10-08).
 *
 * A payment provider proves a settlement with an HMAC-SHA256 over the reported fields and a timestamp, using a
 * shared secret from SPONSUM_SETTLEMENT_WEBHOOK_SECRET_FILE (one line, at least 32 characters, never in the repo).
 * Whether a report is "signed" is decided here, never by a field in the request body. Without a configured secret
 * every webhook is refused (fail-closed).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { DomainError } from "@sponsum/shared";

export const SETTLEMENT_SIGNATURE_HEADER = "x-sponsum-signature";
export const SETTLEMENT_TIMESTAMP_HEADER = "x-sponsum-timestamp";
const TOLERANCE_SECONDS = 300;

export type SettlementReport = {
  provider_event_id: string;
  payment_reference: string;
  observed_amount: string;
  observed_currency: string;
  observed_at?: string;
};

export function settlementWebhookSecret(
  env: NodeJS.ProcessEnv = process.env,
  readFile: (path: string) => string = (path) => readFileSync(path, "utf8")
): string | null {
  const file = (env.SPONSUM_SETTLEMENT_WEBHOOK_SECRET_FILE ?? "").trim();
  if (!file) return null;
  try {
    const secret = readFile(file).trim();
    return secret.length >= 32 ? secret : null;
  } catch {
    return null;
  }
}

function canonical(timestamp: string, provider: string, report: SettlementReport): string {
  return [
    timestamp,
    provider,
    report.provider_event_id,
    report.payment_reference,
    report.observed_amount,
    report.observed_currency,
    report.observed_at ?? ""
  ].join("\n");
}

export function signSettlementReport(secret: string, timestamp: string, provider: string, report: SettlementReport): string {
  return `sha256=${createHmac("sha256", secret).update(canonical(timestamp, provider, report)).digest("hex")}`;
}

function header(headers: Record<string, unknown>, name: string): string {
  const value = headers[name];
  return typeof value === "string" ? value.trim() : "";
}

/** Throws unless the report carries a valid, fresh signature of the configured provider secret. */
export function verifySettlementReport(input: {
  headers: Record<string, unknown>;
  provider: string;
  report: SettlementReport;
  secret: string | null;
  nowMs?: number;
}): void {
  if (!input.secret) {
    throw new DomainError(
      "settlement_webhook_not_configured",
      "Zahlungsmeldungen von Providern sind nicht eingerichtet (Webhook-Geheimnis fehlt)."
    );
  }
  const timestamp = header(input.headers, SETTLEMENT_TIMESTAMP_HEADER);
  const now = Math.floor((input.nowMs ?? Date.now()) / 1000);
  if (!/^\d{9,12}$/.test(timestamp) || Math.abs(now - Number(timestamp)) > TOLERANCE_SECONDS) {
    throw new DomainError("unsigned_webhook", "Die Zahlungsmeldung ist nicht oder nicht mehr gültig signiert.");
  }
  const expected = Buffer.from(signSettlementReport(input.secret, timestamp, input.provider, input.report));
  const supplied = Buffer.from(header(input.headers, SETTLEMENT_SIGNATURE_HEADER));
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new DomainError("unsigned_webhook", "Die Signatur der Zahlungsmeldung ist ungültig.");
  }
}
