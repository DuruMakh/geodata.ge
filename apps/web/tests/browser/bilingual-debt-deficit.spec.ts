import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import { TEST_BASE_URL } from "./test-base-url";

async function expectEnglish(page: Page) {
  expect((await page.locator("body").innerText()).replaceAll("ქართული", "")).not.toMatch(/\p{Script=Georgian}/u);
  const descriptions = await page.locator("[aria-label], [title], svg title").evaluateAll(elements => elements.flatMap(element => [element.getAttribute("aria-label") ?? "", element.getAttribute("title") ?? "", element.tagName.toLowerCase() === "title" ? element.textContent ?? "" : ""]));
  expect(descriptions.filter(text => text !== "ქართული").join(" ")).not.toMatch(/\p{Script=Georgian}/u);
}

for (const scope of ["debt", "deficit"]) test(`${scope} has English initial HTML`, async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL: TEST_BASE_URL });
  try {
    const page = await context.newPage();
    expect((await page.goto(`/en/explorer/${scope}`))?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByTestId(`${scope}-explorer`)).toBeVisible();
    await expectEnglish(page);
  } finally { await context.close(); }
});

function workbookValues(book: ExcelJS.Workbook) {
  return book.worksheets.map(sheet => Array.from({ length: sheet.rowCount }, (_, row) => Array.from({ length: sheet.columnCount }, (_, column) => {
    const cell = sheet.getCell(row + 1, column + 1);
    return cell.type === ExcelJS.ValueType.Number || cell.type === ExcelJS.ValueType.Formula ? cell.value : cell.value === null ? null : "text";
  })));
}
function sources(book: ExcelJS.Workbook) {
  const sheet = book.worksheets[2];
  return Array.from({ length: sheet.rowCount - 3 }, (_, row) => [1, 4, 5].map(column => {
    const cell = sheet.getCell(row + 4, column);
    return cell.type === ExcelJS.ValueType.Hyperlink ? (cell.value as ExcelJS.CellHyperlinkValue).hyperlink : cell.value;
  }));
}

for (const [name, scope, hash] of [
  ["stock", "debt", "f=stock&m=table&r=2013-2025&sel=debt.stock.total,debt.stock.external"],
  ["stock-gdp", "debt", "f=stock&m=table&sh=1&r=2013-2025&sel=debt.stock.total"],
  ["service", "debt", "f=service&m=table&r=2024-2030&sel=debt.service.total,debt.service.principal"],
  ["rate", "debt", "f=rate&m=table&r=2015-2025&sel=debt.rate.total,debt.rate.domestic,debt.rate.external"],
  ["deficit-gel", "deficit", "m=table&sh=0&r=2024-2031&sel=deficit.general_government_balance"],
  ["deficit-gdp", "deficit", "m=table&sh=1&r=2024-2031&sel=deficit.general_government_balance"],
] as const) test(`${name} retains values, status, sources and its URL across language changes`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/en/explorer/${scope}#${hash}`);
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page.getByTestId("chart-mode-table")).toHaveAttribute("aria-pressed", "true");
  await expectEnglish(page);
  if (name === "rate") await expect(page.getByTestId("debt-measure-label")).toHaveText("%");
  if (name === "service") await expect(page.getByTestId("debt-forecast-note")).toContainText("portfolio outstanding on 31 December 2025");
  if (scope === "deficit") await expect(page.getByTestId("deficit-forecast-note")).toContainText("2026–2031");
  const numbers = () => page.getByTestId("explorer-table").locator("tbody tr").evaluateAll(rows => rows.map(row => [...row.querySelectorAll("td")].slice(1).map(cell => {
    const copy = cell.cloneNode(true) as HTMLElement;
    const annotations = copy.querySelectorAll("sup").length;
    copy.querySelectorAll("sup").forEach(annotation => annotation.remove());
    return { value: copy.textContent?.trim(), annotations };
  })));
  const before = await numbers();
  expect(before.length).toBeGreaterThan(0);
  const originalHash = new URL(page.url()).hash;
  const books: ExcelJS.Workbook[] = [];
  const filenames: string[] = [];
  for (const locale of ["en", "ka"]) {
    if (locale === "ka") {
      await page.getByTestId("language-switch").getByRole("link", { name: "ქართული", exact: true }).click();
      await expect(page.locator("html")).toHaveAttribute("lang", "ka");
      await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
      expect(new URL(page.url()).hash).toBe(originalHash);
      expect(await numbers()).toEqual(before);
    }
    const pending = page.waitForEvent("download");
    await page.getByTestId(`${scope}-excel`).click();
    const download = await pending;
    const output = testInfo.outputPath(`${name}-${locale}.xlsx`);
    await download.saveAs(output);
    filenames.push(download.suggestedFilename());
    const book = new ExcelJS.Workbook();
    await book.xlsx.readFile(output);
    books.push(book);
  }
  const [en, ka] = books;
  expect(filenames[0]).toBe(filenames[1].replace(/\.xlsx$/, "-en.xlsx"));
  expect(en.worksheets.map(sheet => sheet.name)).toEqual(["Summary", "Data", "Sources"]);
  expect(workbookValues(en)).toEqual(workbookValues(ka));
  expect(sources(en)).toEqual(sources(ka));
  expect(sources(en).length).toBeGreaterThan(0);
  en.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => {
    expect(JSON.stringify(cell.value)).not.toMatch(/\p{Script=Georgian}/u);
    expect(cell.numFmt ?? "").not.toMatch(/\p{Script=Georgian}/u);
  })));
  const nominal = Array.from({ length: en.worksheets[1].rowCount - 1 }, (_, index) => en.worksheets[1].getCell(index + 2, 4).value);
  if (name === "rate") expect(nominal.every(value => value === null)).toBe(true);
  if (scope === "deficit") expect(nominal.some(value => typeof value === "number" && value < 0)).toBe(true);
  await page.goBack();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  expect(new URL(page.url()).hash).toBe(originalHash);
  expect(await numbers()).toEqual(before);
});

test("English debt search and existing series controls explain rate gaps without GEL", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/en/explorer/debt");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  for (const id of ["debt.rate.domestic", "debt.rate.external"]) {
    const label = page.locator(`[data-series-id="${id}"]`).getByTestId("series-label");
    expect(await label.evaluate(element => element.scrollHeight <= element.clientHeight)).toBe(true);
  }
  const search = page.getByTestId("series-selector").getByRole("searchbox");
  for (const query of ["საპროცენტო", "WEIGHTED-AVERAGE"]) {
    await search.fill(query);
    await expect(page.locator('[data-series-id="debt.rate.total"]')).toBeVisible();
  }
  await page.locator('[data-series-id="debt.rate.total"]').getByTestId("series-row-toggle").click();
  await expect(page.getByTestId("debt-measure-label")).toHaveText("%");
  expect(new URL(page.url()).hash).toContain("f=rate");
  await page.goto("/en/explorer/debt#f=rate&r=2025-2025&sel=debt.rate.domestic");
  await page.reload();
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page.getByTestId("no-range-data-callout")).toContainText("No data is available");
  await expect(page.getByTestId("source-label")).toContainText("have not been replaced with zero");
  await expect(page.getByTestId("debt-measure-label")).not.toContainText("GEL");
  await expectEnglish(page);
});

test("English debt and deficit remain readable on phones", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["debt#f=service&r=2025-2030&sel=debt.service.total", "deficit#m=line&sh=0&r=2024-2031&sel=deficit.general_government_balance"]) {
    await page.goto(`/en/explorer/${route}`);
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    await expectEnglish(page);
    await expect(page.getByTestId("range-marker")).toContainText("Forecast");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
