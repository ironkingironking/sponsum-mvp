import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const folder = mkdtempSync(join(tmpdir(), "sponsum-http-fixture-"));
const secret = "integration-proxy-test-".repeat(3);
process.env.SPONSUM_ACCESS_CONFIG = join(folder, "access.json");
process.env.SPONSUM_STORE_PATH = join(folder, "state.json");
writeFileSync(process.env.SPONSUM_ACCESS_CONFIG, JSON.stringify({ proxySecret: secret, allowedOrigins: ["http://localhost:3000"], legacyTenant: "tenant-movena", tenants: { "tenant-movena": { groups: ["sponsum"], adminGroups: ["sponsum-admin"] } } }));
process.on("exit", () => rmSync(folder, { recursive: true, force: true }));

export function authorizedFetch(url: string, init: RequestInit = {}, as: { subject: string; email: string } = { subject: "http-test-admin", email: "http-admin@example.test" }) {
  return globalThis.fetch(url, { ...init, headers: { ...Object.fromEntries(new Headers(init.headers)), "x-movena-proxy-secret": secret, "x-movena-tenant-id": "tenant-movena", "x-movena-subject": as.subject, "x-movena-email": as.email, "x-movena-groups": "sponsum-admin", Origin: "http://localhost:3000" } });
}
