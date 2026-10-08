import "./sponsum-test-env.js";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("shipped HTTP API isolates users and tenants before side effects or downloads", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sponsum-access-"));
  const config = { proxySecret: "http-test-proxy-".repeat(4), allowedOrigins: ["https://suite.example.test"], legacyTenant: "tenant-a", tenants: { "tenant-a": { groups: ["tenant-a"], adminGroups: ["admin-a"] }, "tenant-b": { groups: ["tenant-b"], adminGroups: ["admin-b"] } } };
  process.env.SPONSUM_ACCESS_CONFIG = join(dir, "access.json");
  process.env.SPONSUM_STORE_PATH = join(dir, "store.json");
  writeFileSync(process.env.SPONSUM_ACCESS_CONFIG, JSON.stringify(config));
  const { createApp } = await import("../../app.js");
  const server = createServer(createApp());
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no bind");
  const base = `http://127.0.0.1:${address.port}/api/sponsum/v1`;
  const alice = { "x-movena-proxy-secret": config.proxySecret, "x-movena-tenant-id": "tenant-a", "x-movena-subject": "alice", "x-movena-email": "alice@example.test", "x-movena-groups": "tenant-a", "Content-Type": "application/json", Origin: config.allowedOrigins[0] };
  const bob = { ...alice, "x-movena-subject": "bob", "x-movena-email": "bob@example.test" };
  const other = { ...bob, "x-movena-tenant-id": "tenant-b", "x-movena-groups": "tenant-b" };
  const call = (url: string, headers: Record<string, string> = alice, data?: unknown) => fetch(base + url, { headers, ...(data === undefined ? {} : { method: "POST", body: JSON.stringify(data) }) });
  const input = { invoice_id: "ACCESS-TEST", nominal_amount: "1000", issue_date: "2026-09-01", maturity_date: "2026-10-01", creditor_party_id: "shared-creditor-name", debtor_party_id: "debtor" };
  try {
    assert.equal((await fetch(base + "/receivables")).status, 403);
    assert.equal((await call("/receivables", { ...alice, "x-movena-proxy-secret": "forged" })).status, 403);
    assert.equal((await call("/receivables", { ...alice, "x-movena-tenant-id": "tenant-b" })).status, 403);
    assert.equal((await call("/receivables", { ...alice, Origin: "https://evil.test" }, input)).status, 403);
    assert.equal((await call("/receivables", alice, { ...input, origin_tenant_id: "tenant-b" })).status, 403);
    assert.equal((await call("/receivables", alice, { ...input, _suite_access: { owner_id: "bob" } })).status, 403);
    const response = await call("/receivables", alice, input);
    assert.equal(response.status, 200); const a = await response.json() as any;
    // DK-31: the same invoice of the same creditor exists once, even if bob cannot see alice's receivable.
    const duplicateB = await call("/receivables", bob, input); assert.equal(duplicateB.status, 409);
    assert.equal(((await duplicateB.json()) as any).error.code, "duplicate_invoice");
    const createdB = await call("/receivables", bob, { ...input, invoice_id: "ACCESS-TEST-B" }); assert.equal(createdB.status, 200);
    const createdOther = await call("/receivables", other, input); assert.equal(createdOther.status, 200);
    assert.equal(((await (await call("/receivables", alice)).json()) as any[]).length, 1);
    assert.equal((await call(`/receivables/${a.receivable_id}/dossier`, bob)).status, 404);
    assert.equal((await call(`/receivables/${a.receivable_id}`, other)).status, 404);
    assert.equal((await call(`/access/assets/${a.receivable_id}`, alice, { readers: ["bob"] })).status, 200);
    assert.equal((await call(`/receivables/${a.receivable_id}`, bob)).status, 200);
    assert.equal((await call(`/receivables/${a.receivable_id}/disputes`, alice, { disputed_amount: "100" })).status, 200);
    const before = readFileSync(process.env.SPONSUM_STORE_PATH, "utf8");
    // Shared readers may download the dossier without triggering automatic writes.
    assert.equal((await call(`/disputes/${a.receivable_id}`, bob)).status, 200);
    assert.equal(readFileSync(process.env.SPONSUM_STORE_PATH, "utf8"), before);
    // POST snapshots contain writable records only, so external form/signature work cannot start.
    assert.equal((await call(`/disputes/${a.receivable_id}/forms`, bob, { template_id: "schlichtungsgesuch", use_ai: true })).status >= 400, true);
    assert.equal((await call(`/receivables/${a.receivable_id}/verify`, bob, {})).status, 404);
    assert.equal((await call(`/disputes/${a.receivable_id}/exports`, bob, { recipient: "Test", confirm: true })).status, 404);
    assert.equal((await call("/kyc/debtor", bob, { status: "PASSED" })).status, 403);
    assert.equal(readFileSync(process.env.SPONSUM_STORE_PATH, "utf8"), before);
    for (const who of [{ ...alice, "x-movena-groups": "admin-a" }, { ...other, "x-movena-groups": "admin-b" }]) {
      assert.equal((await call("/kyc/same-party", who, { status: "PASSED" })).status, 200);
    }
    assert.equal(((await (await call("/receivables", { ...alice, "x-movena-groups": "admin-a" })).json()) as any[]).length, 2);
    assert.equal(((await (await call("/receivables", { ...other, "x-movena-groups": "admin-b" })).json()) as any[]).length, 1);
    const state = JSON.parse(readFileSync(process.env.SPONSUM_STORE_PATH, "utf8"));
    assert.equal(state.kyc.filter((r: any) => r.party_id === "same-party").length, 2, "party IDs cannot collide across tenants");
    assert.equal((await call(`/access/assets/${a.receivable_id}`, alice, { readers: [] })).status, 200);
    assert.equal((await call(`/receivables/${a.receivable_id}`, bob)).status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    delete process.env.SPONSUM_ACCESS_CONFIG; delete process.env.SPONSUM_STORE_PATH;
    rmSync(dir, { recursive: true, force: true });
  }
});
