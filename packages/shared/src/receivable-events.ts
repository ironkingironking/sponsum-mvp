import { createHash } from "node:crypto";
import type { ProtocolEvent, ProtocolEventType } from "./receivable-types.js";

export function hashPayload(payload: Record<string, unknown>): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

export function hashEvent(parts: {
  event_id: string;
  event_type: string;
  payload_hash: string;
  prev_event_hash: string | null;
}): string {
  return createHash("sha256")
    .update(`${parts.event_id}|${parts.event_type}|${parts.payload_hash}|${parts.prev_event_hash ?? ""}`)
    .digest("hex");
}

export function signEventHash(eventHash: string, secret: string): string {
  return createHash("sha256").update(`${secret}:${eventHash}`).digest("hex");
}

export function publicClaimHash(input: {
  invoiceId: string;
  debtorId: string;
  amount: string;
  maturity: string;
  issuerNode: string;
}): string {
  return createHash("sha256")
    .update(`${input.invoiceId}|${input.debtorId}|${input.amount}|${input.maturity}|${input.issuerNode}`)
    .digest("hex");
}

export function makeProtocolEvent(input: {
  event_id: string;
  event_type: ProtocolEventType;
  payload: Record<string, unknown>;
  prev_event_hash: string | null;
  receivable_id?: string | null;
  offer_id?: string | null;
  trade_id?: string | null;
  actor_party_id?: string | null;
  secret?: string;
}): ProtocolEvent {
  const payload_hash = hashPayload(input.payload);
  const event_hash = hashEvent({
    event_id: input.event_id,
    event_type: input.event_type,
    payload_hash,
    prev_event_hash: input.prev_event_hash
  });
  return {
    event_id: input.event_id,
    event_type: input.event_type,
    schema_version: "1.0.0",
    receivable_id: input.receivable_id ?? null,
    offer_id: input.offer_id ?? null,
    trade_id: input.trade_id ?? null,
    actor_party_id: input.actor_party_id ?? null,
    payload: input.payload,
    payload_hash,
    prev_event_hash: input.prev_event_hash,
    event_hash,
    signature: input.secret ? signEventHash(event_hash, input.secret) : null,
    created_at: new Date().toISOString()
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}
