import assert from "node:assert/strict";
import test from "node:test";
import { inScope, resolvePrincipal, type Principal, type AccessConfig } from "./access-context.js";
import { secureStore, scopedState } from "./scoped-store.js";
import { MemorySponsumStore, emptyState } from "./store.js";
import { SponsumService } from "./service.js";
import { setSponsumToday } from "./clock.js";

// Fixtures use maturity dates in autumn 2026; pin «today» so they are not overdue (SPO-03).
setSponsumToday(() => "2026-09-01");

const alice: Principal = { tenantId: "tenant-a", userId: "alice", email: "alice@example.test", admin: false, legacyTenant: "tenant-a" };
const bob = { ...alice, userId: "bob", email: "bob@example.test" };
const other = { ...alice, tenantId: "tenant-b", userId: "charlie" };
const admin = { ...alice, userId: "admin", admin: true };
const cfg: AccessConfig = { proxySecret: "test-proxy-".repeat(5), allowedOrigins: ["https://suite.example.test"], legacyTenant: "tenant-a", tenants: { "tenant-a": { groups: ["tenant-a"], adminGroups: ["admin-a"] }, "tenant-b": { groups: ["tenant-b"], adminGroups: ["admin-b"] } } };
const headers = { "x-movena-proxy-secret": cfg.proxySecret!, "x-movena-tenant-id": "tenant-a", "x-movena-subject": "alice", "x-movena-email": "alice@example.test", "x-movena-groups": "tenant-a" };
function input(invoice = "INV-1") { return { invoice_id: invoice, nominal_amount: "1200", issue_date: "2026-09-01", maturity_date: "2026-10-01", creditor_party_id: "creditor", debtor_party_id: "debtor" }; }

test("principal requires authenticated proxy and membership of the exact tenant", () => {
  assert.equal(resolvePrincipal(headers, cfg).admin, false);
  assert.throws(() => resolvePrincipal({ ...headers, "x-movena-proxy-secret": "" }, cfg));
  assert.throws(() => resolvePrincipal({ ...headers, "x-movena-tenant-id": "tenant-b" }, cfg));
  assert.throws(() => resolvePrincipal({ ...headers, "x-movena-subject": "Guest" }, cfg));
  assert.throws(() => resolvePrincipal({ ...headers, "x-movena-groups": "admin-b" }, cfg));
  assert.equal(resolvePrincipal({ ...headers, "x-movena-groups": "/admin-a" }, cfg).admin, true);
});

test("own records, related counts, parties and downloads cannot cross users or tenants", async () => {
  const raw = new MemorySponsumStore(); const service = new SponsumService(raw);
  const a = inScope(alice, () => service.createReceivable(input()));
  const b = inScope(bob, () => service.createReceivable(input("INV-2")));
  const c = inScope(other, () => service.createReceivable(input()));
  assert.equal(raw.snapshot().assets.length, 3);
  assert.equal(a.origin_tenant_id, "tenant-a"); assert.equal(c.origin_tenant_id, "tenant-b");
  inScope(alice, () => {
    assert.deepEqual(service.listReceivables().map(r => r.receivable_id), [a.receivable_id]);
    assert.equal(service.workspace().kpis.receivables, 1);
    assert.throws(() => service.dossier(b.receivable_id), /not found|nicht gefunden/i);
    assert.throws(() => service.dossier(c.receivable_id), /not found|nicht gefunden/i);
    assert.throws(() => service.verify(b.receivable_id, {}));
    assert.equal(service.events().length, 2);
  });
  const before = JSON.stringify(raw.snapshot());
  await inScope(alice, () => service.listParties());
  inScope(bob, () => service.workspace());
  assert.equal(JSON.stringify(raw.snapshot()), before, "GET must not seed or write data");
  assert.equal(inScope(admin, () => service.listReceivables()).length, 2);
  assert.equal(inScope({ ...other, admin: true }, () => service.listReceivables()).length, 1);
});

test("explicit same-tenant sharing is read-only and never transfers ownership", () => {
  const raw = new MemorySponsumStore(); const service = new SponsumService(raw);
  const a = inScope(alice, () => service.createReceivable(input()));
  inScope(alice, () => service.shareReadAccess("assets", a.receivable_id, ["bob", "charlie"]));
  inScope(bob, () => {
    assert.equal(service.dossier(a.receivable_id).asset.receivable_id, a.receivable_id);
    assert.throws(() => service.openDispute(a.receivable_id, "100"), /Schreibberechtigung/);
    assert.throws(() => service.shareReadAccess("assets", a.receivable_id, ["bob"]));
  });
  assert.equal(inScope(other, () => service.listReceivables()).length, 0);
  inScope(alice, () => service.shareReadAccess("assets", a.receivable_id, []));
  assert.equal(inScope(bob, () => service.listReceivables()).length, 0);
});

test("unknown ownership is tenant-admin-only and unknown collections are hidden", () => {
  const full: any = { ...emptyState(), assets: [{ receivable_id: "legacy-a", origin_tenant_id: "tenant-a" }, { receivable_id: "legacy-b", origin_tenant_id: "tenant-b" }], newly_added_collection: [{ secret: "private" }] };
  assert.equal(scopedState(full, alice).assets.length, 0);
  assert.deepEqual(scopedState(full, admin).assets.map(r => r.receivable_id), ["legacy-a"]);
  assert.deepEqual(scopedState(full, admin).newly_added_collection, []);
});

test("store rejects hidden-ID overwrite, tenant changes, invented metadata and stale snapshots", () => {
  const raw = new MemorySponsumStore(); const service = new SponsumService(raw); const store = secureStore(raw);
  const a = inScope(alice, () => service.createReceivable(input()));
  const b = inScope(bob, () => service.createReceivable(input("INV-2")));
  inScope(alice, () => {
    let view = store.snapshot() as any;
    view.assets.push({ ...view.assets[0], receivable_id: b.receivable_id });
    assert.throws(() => store.replace(view));
    view = store.snapshot(); view.assets[0].origin_tenant_id = "tenant-b";
    assert.throws(() => store.replace(view));
    view = store.snapshot(); view.assets[0]._suite_access.owner_id = "bob";
    assert.throws(() => store.replace(view));
    view = store.snapshot();
    inScope(bob, () => service.createReceivable(input("INV-3")));
    view.assets[0].outstanding_amount = "500";
    assert.throws(() => store.replace(view), /neu laden/);
    assert.equal(service.getReceivable(a.receivable_id).outstanding_amount, "1200.00");
  });
  assert.equal(raw.snapshot().assets.length, 3);
});

test("async request contexts remain isolated", async () => {
  const service = new SponsumService();
  inScope(alice, () => service.createReceivable(input()));
  await Promise.all([inScope(alice, async () => { await new Promise(r => setTimeout(r, 4)); assert.equal(service.listReceivables().length, 1); }), inScope(bob, async () => { await Promise.resolve(); assert.equal(service.listReceivables().length, 0); })]);
});
