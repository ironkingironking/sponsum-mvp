import { createHash } from "node:crypto";
import { DomainError } from "@sponsum/shared";
import { principal, scopeContext, type Principal } from "./access-context.js";

type Row = Record<string, any>;
type State = Record<string, Row[]>;
type Access = { tenant_id: string; owner_id: string; readers: string[] };
type Store = { snapshot(): any; replace(state: any): void };
const wrapped = new WeakMap<object, Store>();
const originals = new WeakMap<object, Store>();
const keys: Record<string, string> = {
  assets: "receivable_id", locks: "receivable_id", registry: "id", verifications: "id", offers: "offer_id",
  bids: "bid_id", trades: "trade_id", instructions: "instruction_id", observations: "observation_id",
  events: "event_id", disclosures: "grant_id", accounting: "proposal_id", kyc: "party_id",
  buyer_profiles: "party_id", assignments: "assignment_id", wechsel_drafts: "instrument_id",
  capital_needs: "need_id", capital_interests: "interest_id", dispute_workbenches: "receivable_id"
};
const roots = new Set(["assets", "capital_needs", "buyer_profiles", "kyc"]);
const digest = (state: unknown) => createHash("sha256").update(JSON.stringify(state) ?? "null").digest("hex");
const deny = () => { throw new DomainError("forbidden", "Datensatz liegt ausserhalb Ihrer Schreibberechtigung."); };
const id = (kind: string, row: Row, fallbackTenant = "") => {
  const key = String(row[keys[kind]] || "");
  return key && ["kyc", "buyer_profiles"].includes(kind) ? `${row._suite_access?.tenant_id || fallbackTenant}\0${key}` : key;
};
const rows = (state: State, kind: string) => Array.isArray(state[kind]) ? state[kind] : [];

function permittedRoot(row: Row, kind: string, who: Principal, write: boolean): boolean {
  const acl: Access | undefined = row._suite_access;
  const tenant = acl?.tenant_id || (kind === "assets" ? row.origin_tenant_id : who.legacyTenant);
  if (tenant !== who.tenantId || (kind === "assets" && row.origin_tenant_id !== tenant)) return false;
  if (who.admin) return true;
  return Boolean(acl && (acl.owner_id === who.userId || (!write && acl.readers?.includes(who.userId))));
}

/** Restrict every collection before any service joins, counts, downloads or writes. */
export function scopedState(full: State, who: Principal, write = false): State {
  const out: State = Object.fromEntries(Object.keys(full).map(k => [k, []]));
  for (const kind of roots) out[kind] = rows(full, kind).filter(row => permittedRoot(row, kind, who, write));
  const assetIds = new Set(out.assets.map(r => r.receivable_id));
  const needIds = new Set(out.capital_needs.map(r => r.need_id));
  const linked = (kind: string, predicate: (r: Row) => boolean) => {
    out[kind] = rows(full, kind).filter(r => (!r._suite_access || r._suite_access.tenant_id === who.tenantId) && predicate(r));
  };
  for (const kind of ["locks", "registry", "verifications", "offers", "trades", "accounting", "assignments", "wechsel_drafts", "dispute_workbenches"]) {
    linked(kind, r => assetIds.has(r.receivable_id));
  }
  const offerIds = new Set(out.offers.map(r => r.offer_id));
  const tradeIds = new Set(out.trades.map(r => r.trade_id));
  linked("bids", r => offerIds.has(r.offer_id));
  linked("disclosures", r => offerIds.has(r.offer_id));
  linked("instructions", r => tradeIds.has(r.trade_id));
  const instructionIds = new Set(out.instructions.map(r => r.instruction_id));
  linked("observations", r => instructionIds.has(r.instruction_id));
  linked("capital_interests", r => needIds.has(r.need_id));
  linked("events", r => assetIds.has(r.receivable_id) || offerIds.has(r.offer_id) || tradeIds.has(r.trade_id) || needIds.has(r.payload?.need_id)
    || (!r.receivable_id && !r.offer_id && !r.trade_id && !r.payload?.need_id && permittedRoot(r, "events", who, write)));
  return structuredClone(out);
}

export function secureStore<T extends Store>(target: T, requireContext = false): T {
  if (originals.has(target)) return target;
  if (wrapped.has(target)) return wrapped.get(target) as T;
  const proxy = new Proxy(target, { get(object, prop) {
    if (prop === "snapshot") return () => {
      const ctx = scopeContext();
      if (!ctx) { if (requireContext) deny(); return object.snapshot(); }
      const full: State = object.snapshot();
      const view = scopedState(full, ctx.principal, ctx.mode === "write");
      ctx.snapshots.set(view, { full, visible: structuredClone(view) });
      return view;
    };
    if (prop === "replace") return (next: State) => {
      const ctx = scopeContext();
      if (!ctx) { if (requireContext) deny(); return object.replace(next); }
      if (ctx.mode === "read") deny();
      const basis = ctx.snapshots.get(next);
      if (!basis) deny();
      const previous = basis!.full as State;
      const visible = basis!.visible as State;
      if (digest(object.snapshot()) !== digest(previous)) throw new DomainError("conflict", "Der Datenbestand wurde geändert. Bitte neu laden.");
      const who = ctx.principal;
      const writable = scopedState(previous, who, true);
      const candidate = structuredClone(next);
      const previousId = (kind: string, row: Row) => id(kind, row, who.legacyTenant);
      const candidateId = (kind: string, row: Row) => id(kind, row, who.tenantId);
      for (const kind of Object.keys(candidate)) {
        if (!keys[kind] || !Array.isArray(candidate[kind])) {
          if (digest(candidate[kind]) !== digest(visible[kind])) deny();
          continue;
        }
        const allIds = new Set(rows(previous, kind).map(r => previousId(kind, r)));
        const shown = new Map(rows(visible, kind).map(r => [previousId(kind, r), r]));
        const canWrite = new Set(rows(writable, kind).map(r => previousId(kind, r)));
        const seen = new Set<string>();
        for (const row of candidate[kind]) {
          const rowId = candidateId(kind, row);
          if (!rowId || seen.has(rowId)) deny();
          seen.add(rowId);
          const old = shown.get(rowId);
          if (old) {
            if (digest(old) !== digest(row) && !canWrite.has(rowId)) deny();
            if (digest(old._suite_access ?? null) !== digest(row._suite_access ?? null)) deny();
            if (kind === "assets" && row.origin_tenant_id !== who.tenantId) deny();
          } else {
            if (allIds.has(rowId) || row._suite_access) deny();
            if (kind === "assets" && row.origin_tenant_id !== who.tenantId) deny();
            row._suite_access = { tenant_id: who.tenantId, owner_id: who.userId, readers: [] } satisfies Access;
          }
        }
        for (const old of rows(visible, kind)) if (!seen.has(previousId(kind, old)) && !canWrite.has(previousId(kind, old))) deny();
      }
      // All new/changed relations must point to a writable root, including nested dossiers.
      const candidateWritable = scopedState(candidate, who, true);
      for (const kind of Object.keys(candidate)) {
        if (!keys[kind]) continue;
        const allowed = new Set(rows(candidateWritable, kind).map(r => candidateId(kind, r)));
        const old = new Map(rows(visible, kind).map(r => [previousId(kind, r), r]));
        for (const row of candidate[kind]) if (digest(row) !== digest(old.get(candidateId(kind, row)))) {
          if (!allowed.has(candidateId(kind, row))) deny();
        }
      }
      const merged = structuredClone(previous);
      for (const kind of Object.keys(candidate)) {
        if (!keys[kind]) continue;
        const shown = new Set(rows(visible, kind).map(r => previousId(kind, r)));
        const replacements = new Map(candidate[kind].map(r => [candidateId(kind, r), r]));
        merged[kind] = rows(previous, kind).flatMap(r => {
          const rowId = previousId(kind, r);
          if (!shown.has(rowId)) return [r];
          const replacement = replacements.get(rowId); replacements.delete(rowId);
          return replacement ? [replacement] : [];
        });
        merged[kind].push(...replacements.values());
      }
      object.replace(merged);
    };
    const result = Reflect.get(object, prop, object);
    return typeof result === "function" ? result.bind(object) : result;
  } });
  wrapped.set(target, proxy); originals.set(proxy, target);
  return proxy;
}

export function setRecordReaders(store: Store, kind: string, recordId: string, readers: unknown) {
  const who = principal();
  if (!who || !["assets", "capital_needs"].includes(kind) || !Array.isArray(readers) || readers.length > 50 || readers.some(v => typeof v !== "string" || !/^[A-Za-z0-9@._:-]{1,255}$/.test(v))) deny();
  const raw = originals.get(store);
  if (!raw) deny();
  const full: State = raw!.snapshot();
  const row = rows(full, kind).find(r => id(kind, r) === recordId && permittedRoot(r, kind, who!, true));
  if (!row) throw new DomainError("not_found", "Datensatz nicht gefunden.");
  row._suite_access = { tenant_id: who!.tenantId, owner_id: row._suite_access?.owner_id || who!.userId, readers: [...new Set(readers as string[])] } satisfies Access;
  raw!.replace(full);
  return { record_id: recordId, readers: row._suite_access.readers };
}
