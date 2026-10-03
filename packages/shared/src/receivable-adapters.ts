import { getPolicy } from "./receivable-policy.js";
import type { ReceivableAsset } from "./receivable-types.js";

export type InstrumentAdapterResult = { ok: false; reason: string } | { ok: true; ref: string };

export function bitcreditCanWrap(asset: ReceivableAsset, jurisdiction: string, enabled: boolean): boolean {
  if (!enabled) return false;
  if (getPolicy(jurisdiction).bitcredit === "DENY") return false;
  return asset.instrument_type === "BITCREDIT_EBILL";
}

export function bitcreditIssue(asset: ReceivableAsset, jurisdiction: string, enabled: boolean): InstrumentAdapterResult {
  if (!bitcreditCanWrap(asset, jurisdiction, enabled)) {
    return { ok: false, reason: "bitcredit_disabled" };
  }
  return { ok: true, ref: `btc-${asset.receivable_id}` };
}

export function registerRightCanWrap(asset: ReceivableAsset, jurisdiction: string, enabled: boolean): boolean {
  if (!enabled) return false;
  if (getPolicy(jurisdiction).register_rights === "DENY") return false;
  return asset.instrument_type === "REGISTER_RIGHT";
}

export function registerRightIssue(
  asset: ReceivableAsset,
  jurisdiction: string,
  enabled: boolean
): InstrumentAdapterResult {
  if (!registerRightCanWrap(asset, jurisdiction, enabled)) {
    return { ok: false, reason: "register_right_disabled" };
  }
  return { ok: true, ref: `reg-${asset.receivable_id}` };
}
