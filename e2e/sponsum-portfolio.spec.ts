import { expect, test } from "@playwright/test";

test.describe("Sponsum navigation UX", () => {
  test("landing, top nav and sidebar open the Sponsum hub", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("sponsum-entry")).toBeVisible();
    await page.getByTestId("sponsum-entry").click();
    await expect(page).toHaveURL(/\/sponsum$/);
    await expect(page.getByTestId("sponsum-hub")).toBeVisible();

    await page.getByTestId("sponsum-entry-invoice").click();
    await expect(page).toHaveURL(/\/sponsum\/invoice\/INV-2026-482$/);
    await expect(page.getByTestId("sponsum-invoice-actions")).toBeVisible();

    await page.getByTestId("nav-sponsum").click();
    await expect(page).toHaveURL(/\/sponsum$/);

    await page.getByTestId("sidebar-sponsum").click();
    await expect(page).toHaveURL(/\/sponsum$/);
    await page.getByTestId("sponsum-entry-portfolio").click();
    await expect(page).toHaveURL(/\/sponsum\/portfolio$/);
    await expect(page.getByTestId("sponsum-portfolio")).toBeVisible();
    await expect(page.getByTestId("sponsum-portfolio-invested")).toContainText("Invested");
    await expect(page.getByTestId("sponsum-portfolio-outstanding")).toContainText("Outstanding nominal");
    await expect(page.getByTestId("sponsum-portfolio-income")).toContainText("Expected income");
  });
});
