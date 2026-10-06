import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import { TEST_BASE_URL } from "./test-base-url";

async function expectEnglish(page: Page) {
  expect((await page.locator("body").innerText()).replaceAll("ქართული", "")).not.toMatch(/\p{Script=Georgian}/u);
  const descriptions = await page.locator("[aria-label], [title], svg title").evaluateAll(elements => elements.flatMap(element => [element.getAttribute("aria-label") ?? "", element.getAttribute("title") ?? "", element.tagName.toLowerCase() === "title" ? element.textContent ?? "" : ""]));
  expect(descriptions.filter(text => text !== "ქართული").join(" ")).not.toMatch(/\p{Script=Georgian}/u);
}

for (const route of ["", "/tbilisi", "/region/imereti", "/region/adjara", "/georgia"]) {
  test(`English municipal ${route || "index"} renders without JavaScript`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL: TEST_BASE_URL });
    try {
      const page = await context.newPage();
      expect((await page.goto(`/en/explorer/municipalities${route}`))?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.locator("h1")).toBeVisible();
      await expectEnglish(page);
    } finally { await context.close(); }
  });
}

test("the index searches both languages, retains its 64 territories and opens English pages from the map and list", async ({ page }) => {
  await page.goto("/en/explorer/municipalities");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page.getByTestId("municipal-list-row")).toHaveCount(64);
  for (const query of ["ბათუმი", "BATUMI"]) {
    await page.getByTestId("municipal-search").fill(query);
    await expect(page.getByTestId("municipal-list-row")).toHaveCount(1);
    await expect(page.getByTestId("municipal-list-row")).toHaveAttribute("href", "/en/explorer/municipalities/batumi");
  }
  await page.getByTestId("municipal-list-row").click();
  await expect(page).toHaveURL(/\/en\/explorer\/municipalities\/batumi$/);
  await expect(page.getByTestId("entity-picker-trigger")).toHaveText("Batumi");
  await page.goBack();
  await expect(page).toHaveURL(/\/en\/explorer\/municipalities$/);
  const marker = page.getByTestId("municipality-marker-04");
  await marker.focus();
  await expect(page.getByTestId("municipality-map-tooltip")).toHaveCount(0);
  await expect(marker).toHaveAccessibleName(/Tbilisi/);
  await expectEnglish(page);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/en\/explorer\/municipalities\/tbilisi/);
  await page.getByTestId("entity-picker-trigger").click();
  const search = page.getByTestId("entity-picker").getByRole("combobox");
  await search.fill("ბათუმი");
  await expect(page.getByTestId("entity-picker").getByRole("option")).toContainText(["Adjara", "Batumi"]);
  await search.press("ArrowDown");
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/en\/explorer\/municipalities\/batumi/);
});

test("Georgian map navigation also supports browser Back and Forward", async ({ page }) => {
  await page.goto("/explorer/municipalities?from=map");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await page.getByTestId("municipal-search").fill("ბათუმი");
  await page.getByTestId("municipal-list-row").click();
  await expect(page).toHaveURL(/\/explorer\/municipalities\/batumi$/);
  await expect(page.getByTestId("entity-picker-trigger")).toHaveText("ბათუმი");
  await page.goBack();
  await expect(page.getByTestId("municipality-map")).toBeVisible();
  expect(new URL(page.url()).search).toBe("?from=map");
  await page.goForward();
  await expect(page.getByTestId("entity-picker-trigger")).toHaveText("ბათუმი");
});

test("switching the regional index keeps its view and accounting scope", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/en/explorer/municipalities#lvl=region");
  await expect(page.getByTestId("municipal-list-row")).toHaveCount(12);
  const country = page.getByTestId("municipal-list-row").first();
  await expect(country).toContainText("69 municipal budgets");
  await expect(country.getByTestId("municipal-row-per-resident")).toHaveCount(0);
  const bars = () => page.getByTestId("municipal-list-row").getByTestId("municipal-row-bar").evaluateAll(elements => elements.map(element => element.getAttribute("style")));
  const before = await bars();
  await page.getByTestId("language-switch").getByRole("link", { name: "ქართული", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ka");
  await expect(page.getByTestId("municipal-list-row")).toHaveCount(12);
  await expect(page).toHaveURL(/\/explorer\/municipalities#lvl=region$/);
  expect(await bars()).toEqual(before);
});

function workbookValues(workbook: ExcelJS.Workbook) {
  return workbook.worksheets.map(sheet => Array.from({ length: sheet.rowCount }, (_, row) => Array.from({ length: sheet.columnCount }, (_, column) => {
    const cell = sheet.getCell(row + 1, column + 1);
    return cell.type === ExcelJS.ValueType.Number || cell.type === ExcelJS.ValueType.Formula ? cell.value : cell.value === null ? null : "text";
  })));
}

for (const [name, path, share] of [["municipality", "/khulo", false], ["region", "/region/imereti", false], ["adjara", "/region/adjara", true], ["country", "/georgia", true]] as const) {
  test(`${name} preserves selected data and original workbook sources across languages`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const route = `/explorer/municipalities${path}#r=2020-2024&m=table&sel=municipal.total,municipal.education${share ? "&sh=1" : ""}`;
    await page.goto(`/en${route}`);
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    await expect(page.getByTestId("municipal-mode-table")).toHaveAttribute("aria-pressed", "true");
    await expectEnglish(page);
    if (name === "adjara") await expect(page.getByTestId("municipal-source-note")).toContainText("six municipalities");
    if (name === "country") await expect(page.getByTestId("municipal-source-note")).toContainText("69 official municipal budget units");
    if (name !== "country") await expect(page.getByTestId("municipal-entity-summary")).toContainText("2025");
    const values = () => page.getByTestId("explorer-table").locator("tbody tr").evaluateAll(rows => rows.map(row => [...row.querySelectorAll("td")].slice(1).map(cell => cell.textContent?.trim())));
    const before = await values();
    expect(before.length).toBeGreaterThan(0);
    const hash = new URL(page.url()).hash;
    const books: ExcelJS.Workbook[] = [];
    const filenames: string[] = [];
    for (const locale of ["en", "ka"]) {
      if (locale === "ka") {
        await page.getByTestId("language-switch").getByRole("link", { name: "ქართული", exact: true }).click();
        await expect(page.locator("html")).toHaveAttribute("lang", "ka");
        await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
        expect(new URL(page.url()).hash).toBe(hash);
        expect(await values()).toEqual(before);
      }
      const pending = page.waitForEvent("download");
      await page.getByTestId("municipal-excel").click();
      const download = await pending;
      const output = testInfo.outputPath(`${name}-${locale}.xlsx`);
      await download.saveAs(output);
      filenames.push(download.suggestedFilename());
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(output);
      books.push(workbook);
    }
    const [en, ka] = books;
    expect(filenames[0]).toBe(filenames[1].replace(/\.xlsx$/, "-en.xlsx"));
    expect(en.worksheets.map(sheet => sheet.name)).toEqual(["Summary", "Data", "Sources"]);
    expect(workbookValues(en)).toEqual(workbookValues(ka));
    const sources = (book: ExcelJS.Workbook) => Array.from({ length: book.worksheets[2].rowCount - 3 }, (_, index) => [1, 4, 5].map(column => {
      const cell = book.worksheets[2].getCell(index + 4, column);
      return cell.type === ExcelJS.ValueType.Hyperlink ? (cell.value as ExcelJS.CellHyperlinkValue).hyperlink : cell.value;
    }));
    expect(sources(en)).toEqual(sources(ka));
    expect(sources(en).length).toBeGreaterThan(0);
    en.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => expect(JSON.stringify(cell.value)).not.toMatch(/\p{Script=Georgian}/u))));
    await page.goBack();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    expect(await values()).toEqual(before);
  });
}

test("English mobile municipal pages fit and retain regional navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const suffix of ["", "/region/racha_lechkhumi_kvemo_svaneti", "/georgia"]) {
    await page.goto(`/en/explorer/municipalities${suffix}`);
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    await expectEnglish(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (suffix.includes("region")) {
      const links = await page.getByTestId("region-member-row").evaluateAll(elements => elements.map(element => element.getAttribute("href")));
      expect(links.length).toBeGreaterThan(0);
      expect(links.every(href => href?.startsWith("/en/explorer/municipalities/"))).toBe(true);
    }
  }
});
