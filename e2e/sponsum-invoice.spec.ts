import { expect, test } from "@playwright/test";

function invoicePath(): string {
  return `/sponsum/invoice/INV-E2E-${Date.now()}`;
}

test.describe("Sponsum invoice UX", () => {
  test("invoice actions: wait, liquidity, accept, no paid click, open portfolio", async ({ page }) => {
    await page.goto(invoicePath());

    const panel = page.getByTestId("sponsum-invoice-actions");
    await expect(panel).toBeVisible();
    await expect(page.getByTestId("sponsum-empty")).toHaveText("Noch kein ReceivableAsset.");
    await expect(page.getByTestId("sponsum-liquidity")).toBeDisabled();
    await expect(page.getByTestId("sponsum-sell")).toBeDisabled();
    await expect(page.getByTestId("sponsum-settlement-readonly")).toContainText("kein «bezahlt»-Klick");
    await expect(page.getByRole("button", { name: /bezahlt|mark paid|paid/i })).toHaveCount(0);

    await page.getByTestId("sponsum-wait").click();
    await expect(page.getByTestId("sponsum-asset-status")).toContainText("Status: ACCEPTED");
    await expect(page.getByTestId("sponsum-asset-status")).toContainText("Verification:");
    await expect(page.getByTestId("sponsum-asset-status")).toContainText("CHF 50000.00");
    await expect(page.getByTestId("sponsum-liquidity")).toBeEnabled();

    await page.getByTestId("sponsum-liquidity").click();
    await expect(page.getByTestId("sponsum-quotes")).toBeVisible();
    await expect(page.getByTestId("sponsum-quote-factor-a")).toBeVisible();
    await expect(page.getByTestId("sponsum-quote-party-b")).toBeVisible();
    await expect(page.getByTestId("sponsum-quote-factor-c")).toBeVisible();
    await expect(page.getByTestId("sponsum-best-offer")).toContainText("Best offer:");
    await expect(page.getByTestId("sponsum-best-offer")).toContainText("party-b");

    await page.getByTestId("sponsum-accept-best").click();
    await expect(page.getByTestId("sponsum-settlement-status")).toContainText("SETTLEMENT_PENDING");
    await expect(page.getByTestId("sponsum-settlement-status")).toContainText("CH93");
    await expect(page.getByTestId("sponsum-settlement-status")).toContainText("Referenz SPN-");
    await expect(page.getByRole("button", { name: /bezahlt|mark paid|paid/i })).toHaveCount(0);
    await expect(page.getByTestId("sponsum-settlement-readonly")).toBeVisible();

    await page.getByTestId("sponsum-open").click();
    await expect(page).toHaveURL(/\/sponsum\/portfolio$/);
    await expect(page.getByTestId("sponsum-portfolio")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sponsum Portfolio" })).toBeVisible();
    await expect(page.getByTestId("sponsum-portfolio-invested")).toContainText("Invested");
  });

  test("sell receivable shows the same RFQ quotes", async ({ page }) => {
    await page.goto(invoicePath());
    await page.getByTestId("sponsum-wait").click();
    await expect(page.getByTestId("sponsum-asset-status")).toContainText("ACCEPTED");
    await page.getByTestId("sponsum-sell").click();
    await expect(page.getByTestId("sponsum-quotes")).toBeVisible();
    await expect(page.getByTestId("sponsum-quote-factor-a")).toBeVisible();
  });
});
