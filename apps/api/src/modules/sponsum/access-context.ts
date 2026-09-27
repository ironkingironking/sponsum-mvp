import { AsyncLocalStorage } from "node:async_hooks";
import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import type { NextFunction, Request, Response } from "express";
import { DomainError } from "@sponsum/shared";

export type Principal = { tenantId: string; userId: string; email: string; admin: boolean; legacyTenant: string };
export type AccessConfig = {
  proxySecretFile?: string;
  proxySecret?: string;
  allowedOrigins: string[];
  legacyTenant: string;
  tenants: Record<string, { groups: string[]; adminGroups: string[]; users?: string[] }>;
};
type Context = { principal: Principal; mode?: "read" | "write"; snapshots: WeakMap<object, { full: Record<string, unknown>; visible: Record<string, unknown> }> };
const context = new AsyncLocalStorage<Context>();

export function principal(): Principal | undefined { return context.getStore()?.principal; }
export function scopeContext() { return context.getStore(); }
export function inScope<T>(who: Principal, fn: () => T, mode?: "read" | "write"): T {
  return context.run({ principal: who, mode, snapshots: new WeakMap() }, fn);
}

function value(input: unknown, maximum = 512): string {
  if (typeof input !== "string" || !input.trim() || input.length > maximum || /[\x00-\x1f]/.test(input)) {
    throw new DomainError("forbidden", "Eine verifizierte persönliche Sitzung ist erforderlich.");
  }
  return input.trim();
}
function normalized(group: string) { return group.trim().replace(/^\/+/, "").toLowerCase(); }
function rejectOverrides(input: unknown, tenant: string): void {
  if (!input || typeof input !== "object") return;
  for (const [key, val] of Object.entries(input)) {
    if (["_suite_access", "tenant_id", "tenantId", "user_id", "userId", "owner_id", "ownerId", "roles", "admin"].includes(key)) {
      throw new DomainError("forbidden", "Benutzer und Rechte werden aus der Sitzung bestimmt.");
    }
    if (key === "origin_tenant_id" && val !== tenant) throw new DomainError("forbidden", "Fremder Mandant.");
    rejectOverrides(val, tenant);
  }
}

export function resolvePrincipal(headers: Record<string, unknown>, config: AccessConfig): Principal {
  const expected = config.proxySecretFile ? readFileSync(config.proxySecretFile, "utf8").trim() : config.proxySecret || "";
  const supplied = typeof headers["x-movena-proxy-secret"] === "string" ? headers["x-movena-proxy-secret"] as string : "";
  if (expected.length < 32 || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    throw new DomainError("forbidden", "Die authentifizierte Suite-Verbindung fehlt.");
  }
  const tenantId = value(headers["x-movena-tenant-id"]);
  const userId = value(headers["x-movena-subject"]);
  const email = value(headers["x-movena-email"]).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || ["anonymous", "Guest", "Administrator"].includes(userId)) {
    throw new DomainError("forbidden", "Eine persönliche Sitzung ist erforderlich.");
  }
  const tenant = config.tenants[tenantId];
  if (!tenant) throw new DomainError("forbidden", "Mandant nicht angebunden.");
  const groups = new Set(String(headers["x-movena-groups"] || "").split(",").map(normalized));
  const admin = tenant.adminGroups.some(g => groups.has(normalized(g)));
  if (!admin && !tenant.groups.some(g => groups.has(normalized(g))) && !tenant.users?.includes(userId)) {
    throw new DomainError("forbidden", "Keine Mitgliedschaft in diesem Mandanten.");
  }
  return { tenantId, userId, email, admin, legacyTenant: config.legacyTenant };
}

export function requireSponsumScope(config?: AccessConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = process.env.SPONSUM_ACCESS_CONFIG;
      if (!config && !file) return res.status(503).json({ error: { code: "access_not_configured", message: "Sponsum-Zugriff ist noch nicht konfiguriert." } });
      const settings: AccessConfig = config || JSON.parse(readFileSync(file!, "utf8"));
      const who = resolvePrincipal(req.headers, settings);
      rejectOverrides(req.body, who.tenantId);
      rejectOverrides(req.query, who.tenantId);
      if (!["GET", "HEAD"].includes(req.method)) {
        if (!req.is("application/json") || !settings.allowedOrigins.includes(req.get("origin") || "")) {
          return res.status(403).json({ error: { code: "forbidden", message: "Die bestätigte Suite-Anfrage fehlt." } });
        }
        if (/^\/(webhooks|kyc)(\/|$)|\/provider-confirm$/.test(req.path) && !who.admin) {
          return res.status(403).json({ error: { code: "forbidden", message: "Diese Aktion erfordert Mandantenadministration." } });
        }
      }
      res.setHeader("Cache-Control", "private, no-store");
      return inScope(who, next, ["GET", "HEAD"].includes(req.method) ? "read" : "write");
    } catch (error) {
      const known = error instanceof DomainError;
      return res.status(known ? 403 : 503).json({ error: { code: known ? "forbidden" : "access_not_configured", message: known ? error.message : "Sponsum-Zugriff konnte nicht sicher geprüft werden." } });
    }
  };
}
