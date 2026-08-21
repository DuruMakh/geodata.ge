import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";

const COUNTRY_URL = `${process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100"}/explorer/municipalities/georgia`;

async function expectMunicipalAppReady(page: Page) {
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
}

async function downloadMunicipalWorkbook(page: Page) {
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("municipal-excel").click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("Expected a local XLSX download path");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Uint8Array.from(await readFile(path)).buffer);
  return { download, workbook };
}

test("Georgia municipal aggregate is a country-only explorer", async ({ page }) => {
  const response = await page.goto(`${COUNTRY_URL}#r=2020-2021`);
  expect(response?.status()).toBe(200);
  await expectMunicipalAppReady(page);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "როგორ ხარჯავენ ბიუჯეტს საქართველოს მუნიციპალიტეტები▾",
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

  const { download, workbook } = await downloadMunicipalWorkbook(page);
  expect(download.suggestedFilename()).toBe("fiscal-municipalities-georgia-2020-2021.xlsx");
  expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["მარტივი ცხრილი", "მონაცემები"]);
  const readable = workbook.getWorksheet("მარტივი ცხრილი")!;
  expect(readable.getCell("A1").value).toBe("საქართველო");
  expect(readable.getRow(3).values).toEqual([
    undefined,
    "კატეგორია",
    2020,
    2021,
    "პერიოდის ცვლილება",
  ]);
  const analysis = workbook.getWorksheet("მონაცემები")!;
  const analysisRows = (analysis.getRows(2, 10) ?? []).filter((row) => row.getCell(1).value !== null);
  expect(analysisRows.map((row) => row.getCell(1).value)).toEqual([2020, 2021]);

  const workbookValues = workbook.worksheets.map((sheet) => sheet.getSheetValues());
  const workbookText = workbookValues.flat(Infinity).map(String);
  const workbookJson = JSON.stringify(workbookValues);
  expect(workbookJson).not.toContain("country.georgia");
  for (const code of ["05", "42", "43", "46", "64"]) {
    expect(workbookText).not.toContain(code);
    expect(workbookJson).not.toContain(`municipality-budget-history-${code}.xlsx`);
  }
  const hyperlinks = readable.getSheetValues().flatMap((row) =>
    Array.isArray(row)
      ? row.flatMap((cell) => typeof cell === "object" && cell && "hyperlink" in cell ? [cell.hyperlink] : [])
      : [],
  );
  expect(hyperlinks.some((value) => value.includes("/downloads/methodology/municipalities/"))).toBe(true);
  expect(hyperlinks).toContain("http://localhost:3000/downloads/methodology/municipalities/files/2016-2025/mof-municipality-budget-history-04.xlsx");
  expect(hyperlinks).toContain("http://localhost:3000/downloads/methodology/municipalities/files/2016-2025/adjara-republic-actual-payments.xlsx");
});
