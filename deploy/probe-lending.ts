/**
 * Read-only probe of the Frappe Lending connection with the deployed bridge code (docs/lending.md). Run on the host
 * from the current release with the service's environment loaded:
 *
 *   cd /opt/docker/movena-sponsum/current && (set -a; . /opt/docker/movena-sponsum/.env; set +a; npx tsx deploy/probe-lending.ts)
 *
 * Until the loan product exists (O1) it probes with a placeholder product name: only reads happen, nothing is created.
 * Prints results only, never credentials.
 */
import { createHttpLendingTransport, lendingConfigFromEnv, readLendingStatus } from "../apps/api/src/modules/sponsum/lending-bridge.js";

const productSet = Boolean((process.env.MOVENA_LENDING_LOAN_PRODUCT ?? "").trim());
const config = lendingConfigFromEnv({ ...process.env, MOVENA_LENDING_LOAN_PRODUCT: process.env.MOVENA_LENDING_LOAN_PRODUCT || "__probe__" });
if (!config) {
  console.log("FAIL config incomplete: MOVENA_LENDING_URL, _COMPANY or _CREDENTIALS_FILE missing or unreadable");
  process.exit(1);
}
const transport = createHttpLendingTransport(config);
const deps = { config, transport };
let failures = 0;
async function check(label: string, run: () => Promise<string>) {
  try {
    console.log(`  OK   ${label}: ${await run()}`);
  } catch (error) {
    failures += 1;
    console.log(`  FAIL ${label}: ${(error as { code?: string }).code ?? ""} ${(error as Error).message}`);
  }
}

async function main() {
  await check("loan product configured (O1)", async () => (productSet ? "yes" : "not yet: Sponsum answers lending_not_configured"));
  await check("status for an unknown receivable", async () => String(await readLendingStatus("SPN-PROBE-NONE", deps)));
  await check("customer lookup", async () => ((await transport.get("Customer", "__probe-does-not-exist__")) === null ? "404 -> null" : "unexpected hit"));
  await check("company exists", async () => {
    const rows = await transport.list("Loan Application", [["company", "=", config.company]], ["name"], 1);
    return `${config.company}, ${rows.length} application(s)`;
  });
  process.exit(failures ? 1 : 0);
}

void main();
