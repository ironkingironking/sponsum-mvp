import { defineConfig, devices } from "@playwright/test";

const API_PORT = process.env.SPONSUM_E2E_API_PORT ?? "4100";
const WEB_PORT = process.env.SPONSUM_E2E_WEB_PORT ?? "3100";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: [
    {
      command: "npx tsx apps/api/src/index.ts",
      url: `http://localhost:${API_PORT}/health`,
      timeout: 60_000,
      reuseExistingServer: false,
      env: {
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://sponsum:sponsum@127.0.0.1:5432/sponsum?schema=public",
        AUTH_SECRET: "playwright-secret-must-be-32-chars-ok",
        CORS_ORIGIN: `http://localhost:${WEB_PORT}`,
        API_PORT,
        RATE_LIMIT_MAX_REQUESTS: "1000"
      }
    },
    {
      command: `npx next dev --hostname localhost -p ${WEB_PORT}`,
      cwd: "apps/web",
      url: `http://localhost:${WEB_PORT}`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        NEXT_PUBLIC_API_BASE_URL: `http://localhost:${API_PORT}`
      }
    }
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
