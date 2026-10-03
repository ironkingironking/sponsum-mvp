// Desk smoke for the Lombard page (O12): serves the real static desk, fakes the Sponsum API with Playwright routing
// and walks the flow in headless Chromium. No server, store, Lending or network needed.
//   node e2e/lombard-desk.mjs            # screenshots into SMOKE_OUT (default: current directory)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { chromium } from "@playwright/test";

const ROOT = new URL("../apps/api/public/", import.meta.url).pathname;
const OUT = process.env.SMOKE_OUT || ".";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = path.endsWith("/") ? join(ROOT, path, "index.html") : join(ROOT, path);
  try {
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const need = {
  need_id: "lom-test1",
  seeker_party_id: "customer:Nordholz AG",
  kind: "LOMBARD",
  amount: "35000.00",
  currency: "CHF",
  status: "CONFIRMED",
  collateral: [{ loan_security: "BTC", qty: 1 }],
  custody_ref: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
  confirmed_by: "admin@example.invalid",
  confirmed_at: "2026-10-03T14:00:00Z",
  created_at: "2026-10-03T14:00:00Z",
  legal_note: "Lombardkredit über Frappe Lending. Verwahrung per Multisig-Treuhand; Sponsum hält keine Werte und keine Schlüssel."
};
const state = { requests: [], posted: null };
const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const browser = await chromium.launch();
const failures = [];
const check = (label, ok, detail = "") => {
  console.log(`  ${ok ? "OK  " : "FAIL"} ${label}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures.push(label);
};
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("dialog", (dialog) => dialog.accept());
  page.on("pageerror", (error) => failures.push(`page error: ${error.message}`));
  await page.route("**/api/sponsum/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/sponsum/v1", "");
    const method = route.request().method();
    if (path === "/workspace") return json(route, { kpis: {}, receivables: [], capital_needs: state.requests, capital_interests: [], capital_providers: [], capital_public: [] });
    if (path === "/parties") return json(route, { companies: [{ id: "seller-ui", name: "Movena GmbH" }], customers: [] });
    if (path === "/lending/customers") return json(route, { configured: true, customers: [{ id: "customer:Nordholz AG", name: "Nordholz AG", erp_name: "Nordholz AG", kind: "customer" }] });
    if (path === "/lombard" && method === "GET") {
      return json(route, {
        configured: true,
        product: "Lombardkredit",
        securities: [
          { code: "BTC", name: "Bitcoin", type: "Kryptowährung", haircut: 50, loan_to_value_ratio: 50, price: 70149.16, price_valid_upto: "2026-10-06 15:53:07" },
          { code: "XAU", name: "Gold", type: "Edelmetalle", haircut: 40, loan_to_value_ratio: 60, price: null, price_valid_upto: null }
        ],
        requests: state.requests
      });
    }
    if (path === "/lombard" && method === "POST") {
      state.posted = route.request().postDataJSON();
      state.requests = [need];
      return json(route, { need, lending: { created: true, loan_application: "ACC-LOAP-2026-00001", loan: null } });
    }
    if (path === "/lombard/lom-test1") {
      return json(route, {
        need,
        configured: true,
        lending: {
          stage: "LOAN",
          application: { name: "ACC-LOAP-2026-00001", status: "Approved", loan_amount: 35000, maximum_loan_amount: 35074 },
          pledges: [{ loan_security: "BTC", qty: 1, loan_security_price: 70149.16, amount: 70149.16, haircut: 50, post_haircut_amount: 35074 }],
          loan: { name: "ACC-LOAN-2026-00001", status: "Disbursed", loan_amount: 35000, disbursed_amount: 35000, total_amount_paid: 0 },
          security: { total_security_value: 70149.16, maximum_loan_value: 35074, status: "Pledged" },
          shortfall: { shortfall_amount: 1500, security_value: 67000, since: "2026-10-03" },
          source: "LENDING · Loan",
          deep_link: "https://erp.movena.ch/desk/loan/ACC-LOAN-2026-00001"
        }
      });
    }
    return json(route, { error: { code: "not_found", message: `smoke: no fake for ${method} ${path}` } }, 404);
  });

  await page.goto(`${base}/sponsum/#/lombard`);
  await page.waitForSelector("#lombard-form");
  check("nav entry 'Lombard'", (await page.locator('nav a[data-nav="lombard"]').count()) === 1);
  check("securities with Lending price", (await page.locator("text=Bitcoin").count()) > 0);
  check("security without price marked", (await page.locator("text=kein Kurs").count()) === 1);
  const row = (i) => page.locator(".lombard-row").nth(i);
  check("one collateral row by default", (await page.locator(".lombard-row").count()) === 1);
  check("only priced securities selectable", (await row(0).locator('option[value="XAU"]').count()) === 0);
  check("the only priced security is preselected", (await row(0).locator('[data-field="sec"]').inputValue()) === "BTC");

  await page.selectOption('select[name="customer_id"]', "customer:Nordholz AG");
  await page.fill('input[name="amount"]', "35000");
  await row(0).locator('[data-field="qty"]').fill("0.5");
  const digits = (text) => text.replace(/[^\d.]/g, "");
  const rowValue = await row(0).locator('[data-field="value"]').textContent();
  check("value shown in the row", rowValue.includes("Wert") && rowValue.replace(/[^\d.·]/g, "").includes("17537.29"), rowValue);
  let value = await page.locator("#lombard-value").textContent();
  check("live total 0.5 BTC after 50 % haircut", digits(value).startsWith("17537.29"), value);
  check("amount above value flagged", (await page.locator("#lombard-value").getAttribute("class")) === "error");

  await page.click("#lombard-add");
  check("'+ Weitere Sicherheit' adds a row", (await page.locator(".lombard-row").count()) === 2);
  await row(1).locator('[data-field="qty"]').fill("3");
  check("quantity without security asks for one", ((await row(1).locator('[data-field="value"]').textContent()) || "").includes("Sicherheit wählen"));
  await row(1).locator("[data-remove]").click();
  check("row can be removed", (await page.locator(".lombard-row").count()) === 1);

  await row(0).locator('[data-field="qty"]').fill("1");
  value = await page.locator("#lombard-value").textContent();
  check("live total 1 BTC", digits(value).startsWith("35074.58") && !value.includes("zu hoch"), value);
  await page.fill('input[name="custody_ref"]', need.custody_ref);
  await page.screenshot({ path: join(OUT, "lombard-page.png"), fullPage: true });

  await page.click('#lombard-form button[type="submit"]');
  await page.waitForURL(/#\/lombard\/lom-test1$/);
  await page.waitForSelector("text=In Lending öffnen");
  check(
    "request body",
    state.posted?.confirm === true && state.posted?.customer_id === "customer:Nordholz AG" && JSON.stringify(state.posted?.pledges) === '[{"loan_security":"BTC","qty":1}]' && state.posted?.custody_ref === need.custody_ref,
    JSON.stringify(state.posted)
  );
  check("dossier shows shortfall", (await page.locator(".error[role=alert]", { hasText: "Unterdeckung" }).count()) === 1);
  check("deep link to the loan", (await page.locator('a[href="https://erp.movena.ch/desk/loan/ACC-LOAN-2026-00001"]').count()) === 1);
  check("custody reference shown", (await page.locator(`text=${need.custody_ref}`).count()) > 0);
  await page.screenshot({ path: join(OUT, "lombard-dossier.png"), fullPage: true });
} finally {
  await browser.close();
  server.close();
}
if (failures.length) {
  console.log(`FAIL ${failures.length}: ${failures.join("; ")}`);
  process.exit(1);
}
console.log("Lombard desk smoke OK");
