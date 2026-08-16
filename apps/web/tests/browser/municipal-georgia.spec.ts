import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const COUNTRY_URL = `${process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100"}/explorer/municipalities/georgia`;

async function expectMunicipalAppReady(page: Page) {
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
}

test("Georgia municipal aggregate is a country-only explorer", async ({ page }) => {
  const response = await page.goto(COUNTRY_URL);
  expect(response?.status()).toBe(200);
  await expectMunicipalAppReady(page);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "როგორ ხარჯავენ ბიუჯეტს საქართველოს მუნიციპალიტეტები▾",
  );
  await expect(page.getByTestId("explorer-shell")).toContainText(
    "69 მუნიციპალური საბიუჯეტო ერთეული · 2015–2025",
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

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("municipal-csv").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^geodata-municipalities-georgia-\d{4}-\d{4}\.csv$/);
  const csvPath = await download.path();
  if (!csvPath) throw new Error("Expected a local CSV download path");
  const csvBytes = await readFile(csvPath);
  expect([...csvBytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const csv = csvBytes.toString("utf8");
  expect(csv).toContain("საქართველო");
  expect(csv).toContain("country.georgia");
  for (const code of ["05", "42", "43", "46", "64"]) {
    expect(csv).not.toMatch(new RegExp(`,${code},`));
  }
});
