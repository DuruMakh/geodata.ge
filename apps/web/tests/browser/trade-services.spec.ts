import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { tableSeriesCount, tableSeriesValues } from "./explorer-table";
import { workbookMessage } from "../../lib/i18n/workbook";

const toggle = (page: Page, id: string) => page.locator(`[data-series-id="${id}"]`).getByTestId("series-row-toggle");
const section = (page: Page, id: string) => page.getByTestId(`trade-services-section-${id}`);

for (const prefix of ["", "/en"]) for (const width of [390, 768, 1440]) {
  test(`Services countries use both flows and remember comparisons ${prefix || "ka"} ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${prefix}/explorer/trade/services#section=types&measure=trade.imports&view=table&start=2022&end=2024&sel=services.travel`);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.getByTestId("trade-services-tabs").getByRole("button").evaluateAll(buttons => buttons.every(button => button.scrollWidth <= button.clientWidth))).toBe(true);
    await page.getByTestId("trade-services-dimension-countries").click();
    await expect(page.getByTestId("trade-services")).toHaveAttribute("data-section", "countries");
    await expect(page.getByTestId("trade-services-dimension-countries")).toBeFocused();
    await expect(section(page, "trade.imports")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
    await expect(page.getByTestId("range-start-handle")).toHaveAttribute("aria-valuenow", "2022");
    await expect(page.getByTestId("series-status")).toContainText("1 / 154");
    const dimensions = await page.getByTestId("trade-services-dimensions").boundingBox(), search = page.getByTestId("series-search");
    expect(dimensions!.y).toBeLessThan((await search.boundingBox())!.y);
    await expect(page.getByTestId("trade-partners-ranking-row")).toHaveCount(10);
    await search.fill("826");
    await expect(toggle(page, "partner.2020-2024.826")).toBeVisible();
    await toggle(page, "services.total").click();
    await toggle(page, "partner.2020-2024.826").click();
    await expect(page.getByTestId("trade-partners-ranking-row")).toHaveCount(10);
    const countryHash = new URL(page.url()).hash;
    expect(new URLSearchParams(countryHash.slice(1)).get("section")).toBe("countries");
    const catalogue = JSON.parse(await readFile("../../data/taxonomy/trade-services.json", "utf8")) as { id: string; labelEn: string; labelKa: string }[];
    const uk = catalogue.find(e => e.id === "partner.2020-2024.826")![prefix ? "labelEn" : "labelKa"];
    const imports = await tableSeriesValues(page.getByTestId("explorer-table"), uk);
    expect(imports).toHaveLength(3);
    expect(imports.every(value => value !== "—")).toBe(true);
    await section(page, "trade.exports").click();
    expect(await tableSeriesValues(page.getByTestId("explorer-table"), uk)).not.toEqual(imports);
    await section(page, "trade.imports").click();
    await page.getByTestId("trade-services-dimension-types").click();
    await expect(toggle(page, "services.travel")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("trade-services-dimension-countries").click();
    await expect(toggle(page, "partner.2020-2024.826")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("series-status")).toContainText("1 / 154");
    await page.reload();
    await expect(page.getByTestId("trade-services")).toHaveAttribute("data-section", "countries");
    await expect(toggle(page, "partner.2020-2024.826")).toHaveAttribute("aria-pressed", "true");
    await page.goBack();
    await expect(page.getByTestId("trade-services")).toHaveAttribute("data-section", "types");
    await page.goForward();
    await expect(page.getByTestId("trade-services")).toHaveAttribute("data-section", "countries");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width !== 390) return;
    await page.getByTestId("sidebar-toggle").click();
    await page.getByTestId("data-sidebar").getByRole("link", { name: prefix ? "ქართული" : "English", exact: true }).click();
    await expect(page.getByTestId("trade-services")).toHaveAttribute("data-section", "countries");
    await expect(section(page, "trade.imports")).toHaveAttribute("aria-pressed", "true");
    await expect(toggle(page, "partner.2020-2024.826")).toHaveAttribute("aria-pressed", "true");
    await search.fill("UK");
    await expect(toggle(page, "partner.2020-2024.826")).toBeVisible();
    await page.getByTestId("series-toggle-all").click();
    await expect(page.getByTestId("trade-partners-excel-download")).toBeDisabled();
    await page.getByTestId("series-toggle-all").click();
    await expect(page.getByTestId("series-status")).toContainText("154 / 154");
    await expect(page.getByTestId("trade-partners-ranking-row")).toHaveCount(10);
    await page.getByTestId("series-toggle-all").click();
    await page.reload();
    await expect(page.getByTestId("series-status")).toContainText("0 / 154");
    await expect(page.getByTestId("no-selection-callout")).toBeVisible();
    await page.getByTestId("trade-partners-show-all").click();
    await expect(page.getByTestId("trade-partners-ranking-row")).toHaveCount(107);
    await expect(page.getByTestId("trade-partners-unavailable-row")).toHaveCount(42);
  });
}

test("country Excel uses published imports, gaps and the correct archived originals", async ({ page, request }) => {
  await page.goto("/en/explorer/trade/services#section=countries&measure=trade.imports&sel=partner.2020-2024.826,partner.2020-2024.496&start=2020&end=2024&view=table");
  await expect(page.getByTestId("series-status")).toContainText("2 / 154");
  const download = page.waitForEvent("download");
  await page.getByTestId("trade-partners-excel-download").click();
  const file = await download;
  expect(file.suggestedFilename()).toContain("trade-services-countries");
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await file.path())!);
  expect(workbook.worksheets).toHaveLength(3);
  const rows = workbook.worksheets[1].getSheetValues() as unknown[][];
  expect(rows.filter(row => row?.includes("United Kingdom") && row.includes(2024))[0][4]).toBeCloseTo(96175488.549999951, 6);
  expect(rows.filter(row => row?.includes("Mongolia") && row.includes(2020))[0][4] ?? null).toBeNull();
  const sourceCells = JSON.stringify(workbook.worksheets[2].getSheetValues());
  expect(sourceCells).toContain("georgian-imports-of-services-by-countries.xlsx");
  expect(sourceCells).not.toContain("services-by-types");
  for (const [filename, hash] of [["georgian-imports-of-services-by-countries.xlsx", "06a2ce5527af858c2e9670354ef26fd549a255a9d02b37a3656aeb8cf621af50"], ["georgian-exports-of-services-by-countries.xlsx", "f34b544286ef73baf0a045b5273aa916eae5515e680c9361cfbae6294c1e1e9f"]]) {
    const response = await request.get(`/downloads/methodology/trade/files/${filename}`);
    expect(response.status()).toBe(200);
    expect(createHash("sha256").update(await response.body()).digest("hex")).toBe(hash);
  }
});

for (const prefix of ["", "/en"]) for (const width of [390, 768, 1440]) {
  test(`Services defaults, independent ranking and complete selection ${prefix || "ka"} ${width}px`, async ({ page }) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${prefix}/explorer/trade`);
    const cards = page.getByTestId("trade-hub").getByTestId("hub-card");
    await expect(cards).toHaveCount(6); await cards.nth(4).click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/explorer/trade/services$`));
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(prefix ? "Services trade" : "მომსახურებით ვაჭრობა");
    const tabs = page.getByTestId("trade-services-tabs");
    await expect(tabs.getByRole("button")).toHaveCount(5);
    await page.evaluate(() => document.fonts.ready);
    expect(await tabs.getByRole("button").evaluateAll(buttons => buttons.every(button => button.scrollWidth <= button.clientWidth))).toBe(true);
    // U22-14: the five tabs are one row at every width; on a phone the row scrolls sideways.
    expect((await tabs.boundingBox())!.height).toBeLessThan(60);
    await expect(section(page, "overview")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("series-status")).toContainText("1 / 4");
    await expect(toggle(page, "trade.turnover")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "line");
    await expect(page.getByTestId("range-start-handle")).toHaveAttribute("aria-valuenow", "2020");
    await expect(page.getByTestId("range-end-handle")).toHaveAttribute("aria-valuenow", "2024");
    await expect(page.getByTestId("trade-summary").locator("[data-indicator]")).toHaveCount(4);
    await expect(page.getByTestId("trade-balance-context")).toBeVisible();
    await expect(page.getByTestId("source-label").getByRole("link")).toHaveAttribute("href", `${prefix}/methodology/trade`);
    expect(await page.getByRole("heading", { level: 1 }).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.getByTestId("chart-mode-line").evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(11);
    if (width !== 390) {
      // Width checks at every width; the selection logic below runs once per locale, at 390.
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(errors).toEqual([]);
      return;
    }
    await page.evaluate(() => document.fonts.ready);
    const axis = () => page.getByTestId("chart-panel").locator('svg text[text-anchor="end"]').allTextContents();
    const scale = await axis();
    // Four rows are read at a glance: no search field (DESIGN §7.7, U21-09).
    await expect(page.getByTestId("series-search")).toHaveCount(0);
    await page.getByTestId("series-toggle-all").click();
    await expect(page.getByTestId("trade-excel-download")).toBeDisabled();
    await expect(page.getByTestId("trade-summary")).toBeVisible();
    await page.getByTestId("series-toggle-all").click();
    await expect(page.getByTestId("series-status")).toContainText("4 / 4");
    expect(await axis()).toEqual(scale);
    await page.getByTestId("chart-mode-table").click();
    expect(await tableSeriesCount(page.getByTestId("explorer-table"))).toBe(4);

    await section(page, "trade.exports").click();
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "trade.exports");
    await expect(section(page, "trade.exports")).toHaveAttribute("aria-pressed", "true");
    await section(page, "trade.turnover").click();
    await expect(section(page, "trade.turnover")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId(/trade-partners-measure-/)).toHaveCount(0);
    await expect(page.getByTestId("series-status")).toContainText("1 / 13");
    await expect(page.getByTestId("series-list").getByTestId("series-row").first()).toHaveAttribute("data-series-id", "services.total");
    await expect(toggle(page, "services.total")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "trade.turnover");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "line");
    await expect(page.getByTestId("trade-partners-tab-countries")).toHaveCount(0);
    await expect(page.getByTestId("trade-partners-tab-groups")).toHaveCount(0);
    await expect(page.getByTestId("trade-partners-ranking-row")).toHaveCount(12);
    await expect(page.getByTestId("trade-partners-show-all")).toHaveCount(0);
    // Pin the denominator to the national amount, independently of selected chart series.
    const facts = parse(await readFile("../../data/imports/trade-services-annual.csv"), { columns: true, bom: true }) as Record<string, string>[];
    const amount = (id: string) => Number(facts.find(row => row.entity_id === id && row.year === "2024" && row.indicator_id === "trade.turnover")!.value_usd);
    const travelRow = page.locator('[data-testid="trade-partners-ranking-row"][data-entity-id="services.travel"]');
    await expect(travelRow.locator("td").last()).toHaveText(`${(amount("services.travel") / amount("services.total") * 100).toFixed(1)}%`);
    const typeScale = await axis();
    await page.getByTestId("series-search").fill(prefix ? "Travel" : "მოგზაურობა");
    await expect(toggle(page, "services.travel")).toBeVisible();
    await page.getByTestId("series-search").fill(prefix ? "მოგზაურობა" : "Travel");
    await expect(toggle(page, "services.travel")).toBeVisible();
    await page.getByTestId("series-toggle-all").click(); await page.getByTestId("series-toggle-all").click();
    await expect(page.getByTestId("series-status")).toContainText("13 / 13");
    expect(await axis()).toEqual(typeScale);
    await expect(page.getByTestId("trade-partners-ranking-row")).toHaveCount(12);
    await page.getByTestId("chart-mode-table").click();
    expect(await tableSeriesCount(page.getByTestId("explorer-table"))).toBe(13);
    await section(page, "trade.balance").click();
    await expect(page.getByTestId("trade-partners-ranking")).toHaveAttribute("data-has-share", "false");
    await expect(page.getByTestId("trade-partners-zero-axis").first()).toBeVisible();
    await expect(page.locator('[data-entity-id="services.construction"][data-testid="trade-partners-ranking-row"]')).toContainText("−");
    await page.getByTestId("series-toggle-all").click();
    await expect(page.getByTestId("trade-partners-excel-download")).toBeDisabled();
    await expect(page.getByTestId("trade-partners-ranking-row")).toHaveCount(12);
    await page.reload();
    await expect(page.getByTestId("series-status")).toContainText("0 / 13");
    await expect(page.getByTestId("no-selection-callout")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

// 390 takes the sidebar-toggle path, 1440 the desktop sidebar.
for (const prefix of ["", "/en"]) for (const width of [390, 1440]) {
  test(`Services missingness, keyboard, view memory and navigation ${prefix || "ka"} ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${prefix}/explorer/trade/services#section=types&measure=trade.exports&sel=services.maintenance_repair&view=table&start=2020&end=2024`);
    await expect(page.getByTestId("series-status")).toContainText("1 / 13");
    await expect(section(page, "trade.exports")).toHaveAttribute("aria-pressed", "true");
    const entities = JSON.parse(await readFile("../../data/taxonomy/trade-services.json", "utf8")) as { id: string; labelEn: string; labelKa: string }[];
    const label = entities.find(entity => entity.id === "services.maintenance_repair")![prefix ? "labelEn" : "labelKa"];
    const values = await tableSeriesValues(page.getByTestId("explorer-table"), label);
    expect(values).toHaveLength(5); expect(values[0]).toBe("—");
    const end = page.getByTestId("range-end-handle");
    await end.focus(); await end.press("Home");
    await expect(end).toHaveAttribute("aria-valuenow", "2020");
    await expect(page.getByTestId("trade-partners-unavailable-row")).toHaveCount(1);
    await expect(page.getByTestId("trade-partners-ranking-row")).toHaveCount(11);
    await section(page, "trade.imports").click();
    expect((await tableSeriesValues(page.getByTestId("explorer-table"), label))[0]).not.toBe("—");
    await section(page, "trade.balance").click();
    expect((await tableSeriesValues(page.getByTestId("explorer-table"), label))[0]).toBe("—");
    await section(page, "trade.turnover").click();
    expect((await tableSeriesValues(page.getByTestId("explorer-table"), label))[0]).toBe("—");
    await section(page, "trade.balance").click();
    const savedTypes = page.url();
    await section(page, "overview").focus(); await section(page, "overview").press("Enter");
    await expect(section(page, "overview")).toBeFocused();
    await expect(page.getByTestId("series-status")).toContainText("1 / 4");
    await toggle(page, "trade.turnover").focus(); await toggle(page, "trade.turnover").press("Space");
    await expect(page.getByTestId("series-status")).toContainText("0 / 4");
    await page.getByTestId("chart-mode-table").click();
    await section(page, "trade.balance").focus(); await section(page, "trade.balance").press("Enter");
    await expect(section(page, "trade.balance")).toBeFocused();
    await expect(page).toHaveURL(savedTypes);
    await page.goBack();
    await expect(page.getByTestId("trade-services")).toHaveAttribute("data-section", "overview");
    await expect(page.getByTestId("series-status")).toContainText("0 / 4");
    await page.goForward(); await expect(page).toHaveURL(savedTypes);
    if (width < 900) await page.getByTestId("sidebar-toggle").click();
    await page.getByTestId("trade-services-link").click(); await expect(page).toHaveURL(savedTypes);
    if (width < 900) await expect(page.getByTestId("sidebar-toggle")).toHaveAttribute("aria-expanded", "false");
    if (width < 900) await page.getByTestId("sidebar-toggle").click();
    await page.getByTestId("data-sidebar").getByRole("link", { name: prefix ? "ქართული" : "English", exact: true }).click();
    await expect(page.getByTestId("trade-services")).toHaveAttribute("data-section", "types");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "trade.balance");
    await expect(page.getByTestId("range-end-handle")).toHaveAttribute("aria-valuenow", "2020");
    await page.reload();
    await expect(toggle(page, "services.maintenance_repair")).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

for (const prefix of ["", "/en"]) test(`Services real Excel includes every selected value and applicable originals ${prefix || "ka"}`, async ({ page, request }) => {
  test.setTimeout(60_000);
  const facts = parse(await readFile("../../data/imports/trade-services-annual.csv"), { columns: true, bom: true }) as Record<string, string>[];
  const entities = JSON.parse(await readFile("../../data/taxonomy/trade-services.json", "utf8")) as { id: string; labelEn: string; labelKa: string }[];
  const archive = parse(await readFile("../../data/methodology/source-archives/trade.csv"), { columns: true, bom: true }) as Record<string, string>[];
  const download = async (id: string) => {
    const pending = page.waitForEvent("download"); await page.getByTestId(id).click();
    const file = await pending, excel = new ExcelJS.Workbook(); await excel.xlsx.readFile((await file.path())!);
    expect(file.suggestedFilename()).toContain("trade-services"); return excel;
  };
  for (const measure of ["trade.exports", "trade.imports", "trade.turnover", "trade.balance"]) {
    await page.goto(`${prefix}/explorer/trade/services#section=types&measure=${measure}`);
    await expect(page.getByTestId("series-status")).toContainText("1 / 13");
    await page.getByTestId("series-search").fill(prefix ? "მოგზაურობა" : "Travel");
    await page.getByTestId("series-toggle-all").click(); await page.getByTestId("series-toggle-all").click();
    await expect(page.getByTestId("series-status")).toContainText("13 / 13");
    const ranking = page.locator('[data-testid="trade-partners-ranking-row"][data-entity-id="services.travel"]');
    if (measure === "trade.balance") {
      await expect(page.getByTestId("trade-partners-ranking")).toHaveAttribute("data-has-share", "false");
      expect(await ranking.locator("td").count()).toBe(2);
    } else {
      const amount = (id: string) => Number(facts.find(row => row.entity_id === id && row.year === "2024" && row.indicator_id === measure)!.value_usd);
      await expect(ranking.locator("td").last()).toHaveText(`${(amount("services.travel") / amount("services.total") * 100).toFixed(1)}%`);
    }
    const excel = await download("trade-partners-excel-download"), data = excel.worksheets[1];
    expect(excel.worksheets).toHaveLength(3); expect(data.rowCount).toBe(66);
    const seen = new Set<string>();
    data.eachRow((row, index) => {
      if (index === 1) return;
      const year = String(row.getCell(1).value), label = row.getCell(3).value;
      const entity = entities.find(item => item[prefix ? "labelEn" : "labelKa"] === label)!;
      expect(entity).toBeTruthy(); seen.add(`${entity.id}:${year}`);
      const fact = facts.find(item => item.entity_id === entity.id && item.year === year && item.indicator_id === measure);
      const value = fact?.value_usd ? Number(fact.value_usd) : null;
      expect(row.getCell(4).value).toBe(value);
      expect(row.getCell(5).value).toBe(workbookMessage(prefix ? "en" : "ka", value === null ? "workbook.unavailable" : "workbook.actual"));
      expect(row.getCell(6).value).toBe(prefix ? "Unspecified" : "დაუზუსტებელი");
    });
    expect(seen.size).toBe(65);
    expect(JSON.stringify(data.getRow(1).values)).not.toMatch(/source_id|entity_id|source_refs|source_block/);
    const links = excel.worksheets[2].getColumn(4).values.filter(value => typeof value === "object" && value !== null && "hyperlink" in value) as { hyperlink: string }[];
    expect(links).toHaveLength(measure === "trade.exports" || measure === "trade.imports" ? 1 : 2);
    for (const link of links) {
      const pathname = new URL(link.hyperlink).pathname, source = archive.find(row => `/${row.public_download_path}` === pathname)!;
      expect(source).toBeTruthy(); expect(pathname).toMatch(/services-by-types\.xlsx$/);
      if (measure === "trade.exports") expect(pathname).toContain("exports");
      if (measure === "trade.imports") expect(pathname).toContain("imports");
      const response = await request.get(pathname); expect(response.ok()).toBe(true);
      expect(createHash("sha256").update(await response.body()).digest("hex")).toBe(source.sha256);
    }
  }
  await section(page, "overview").click();
  await page.getByTestId("series-toggle-all").click(); await page.getByTestId("series-toggle-all").click();
  const national = await download("trade-excel-download");
  expect(national.worksheets[1].rowCount).toBe(21);
  const nationalIndicators = prefix ? {
    "Total services trade": "trade.turnover", "Services exports": "trade.exports",
    "Services imports": "trade.imports", "Services balance": "trade.balance",
  } : {
    "მომსახურებით ვაჭრობა სულ": "trade.turnover", "მომსახურების ექსპორტი": "trade.exports",
    "მომსახურების იმპორტი": "trade.imports", "მომსახურების სალდო": "trade.balance",
  };
  const nationalPairs = new Set<string>();
  national.worksheets[1].eachRow((row, index) => {
    if (index === 1) return;
    const year = String(row.getCell(1).value), label = String(row.getCell(3).value);
    const indicator = nationalIndicators[label as keyof typeof nationalIndicators];
    expect(indicator).toBeTruthy();
    const pair = `${indicator}:${year}`;
    expect(nationalPairs.has(pair)).toBe(false); nationalPairs.add(pair);
    const fact = facts.find(item => item.entity_id === "services.total" && item.year === year && item.indicator_id === indicator);
    expect(fact).toBeTruthy();
    expect(row.getCell(4).value).toBe(Number(fact!.value_usd));
  });
  expect([...nationalPairs].sort()).toEqual(facts.filter(fact => fact.entity_id === "services.total").map(fact => `${fact.indicator_id}:${fact.year}`).sort());
  expect(nationalPairs.size).toBe(20);
  const metadata = archive.find(row => row.public_download_path.endsWith("1004_180325_en.pdf"))!;
  const response = await request.get(`/${metadata.public_download_path}`); expect(response.ok()).toBe(true);
  expect(createHash("sha256").update(await response.body()).digest("hex")).toBe(metadata.sha256);
});
