import { expect, test, type Page } from "@playwright/test";
import { TEST_BASE_URL } from "./test-base-url";

const COUNTRY_URL = `${TEST_BASE_URL}/explorer/municipalities/georgia`;

async function expectMunicipalAppReady(page: Page) {
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
}

test("Georgia municipal aggregate is a country-only explorer", async ({ page }) => {
  const response = await page.goto(`${COUNTRY_URL}#r=2020-2021`);
  expect(response?.status()).toBe(200);
  await expectMunicipalAppReady(page);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "როგორ ხარჯავენ ბიუჯეტს საქართველოს მუნიციპალიტეტები",
  );
  await expect(page.getByTestId("explorer-shell")).toContainText(
    "69 მუნიციპალური საბიუჯეტო ერთეული + აჭარის ა.რ. · 2015–2025",
  );

  const sourceNote = page.getByTestId("municipal-source-note");
  await expect(sourceNote).toContainText("69 ოფიციალურ მუნიციპალურ საბიუჯეტო ერთეულს");
  await expect(sourceNote).toContainText("აჭარის ა.რ. რესპუბლიკური ბიუჯეტის ფაქტობრივ გადასახდელებს");
  await expect(sourceNote).toContainText("ტრანსფერების გამოკლებით");
  await expect(sourceNote).toContainText("ფუნქციური სერიები მხოლოდ მუნიციპალურ კლასიფიკაციას");
  await expect(sourceNote).toContainText("ხუთი ოკუპირებულ ტერიტორიებთან დაკავშირებული ორგანო");
  await expect(sourceNote).toContainText("ტერიტორიულად მიკუთვნებულ ხარჯად არ არის წარმოდგენილი");

  const selector = page.getByTestId("series-selector");
  await expect(selector.getByTestId("series-status")).toContainText(/სერიები\s*1 \/ 11/);
  await expect(selector.getByTestId("series-row")).toHaveCount(11);
  await expect(selector.locator('[data-level="total"] [data-testid="series-row-toggle"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await expect(page.getByTestId("chart-frame")).toBeVisible();
  await expect(page.getByTestId("municipal-share-toggle")).toBeVisible();
  await expect(page.getByTestId("year-range-strip")).toBeVisible();
  await expect(page.getByTestId("period-comparison")).toBeVisible();
  await expect(page.getByTestId("entity-kpi")).toHaveCount(4);
  await expect(page.getByTestId("region-member-row")).toHaveCount(0);
  await expect(page.getByTestId("municipal-entity-navigation")).toHaveCount(0);
  // The workbook contract lives in bilingual-municipal.spec.ts (country case).
});
