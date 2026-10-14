import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { tableSeriesCount, tableSeriesValues } from "./explorer-table";

type Classification = "sitc" | "bec";
type Fact = { entity_id?: string; year: string; indicator_id: string; value_usd: string };
type Entity = { id: string; classification: Classification; sourceCode: string; labelKa: string; labelEn: string };
const root = path.resolve(process.cwd(), "../..");
const artifacts = path.join(root, ".tmp/trade-composition-controls");
let facts: Fact[], national: Fact[], entities: Entity[];
test.beforeAll(async () => {
  facts = parse(await readFile(path.join(root, "data/imports/trade-composition-annual.csv")), { columns: true, bom: true });
  national = parse(await readFile(path.join(root, "data/imports/trade-overview-annual.csv")), { columns: true, bom: true });
  entities = JSON.parse(await readFile(path.join(root, "data/taxonomy/trade-composition.json"), "utf8"));
  await mkdir(artifacts, { recursive: true });
});
const section = (page: Page, value: Classification) => page.getByTestId(`trade-composition-section-${value}`);
const toggle = (page: Page, id: string) => page.locator(`[data-testid="series-row"][data-series-id="${id}"]`).getByTestId("series-row-toggle");
const selected = (page: Page, count: number, total: number) => expect(page.getByTestId("series-status")).toContainText(`${count} / ${total}`);
async function language(page: Page, name: string) {
  if (page.viewportSize()!.width < 900) await page.getByTestId("sidebar-toggle").click();
  await page.getByTestId("data-sidebar").getByRole("link", { name, exact: true }).click();
}
async function ranking(page: Page, classification: Classification, flow: string, year = 2025) {
  const rows = page.getByTestId("trade-partners-ranking-row");
  await expect(rows).toHaveCount(classification === "sitc" ? 10 : 7);
  const denominator = Number(national.find(f => Number(f.year) === year && f.indicator_id === flow)!.value_usd);
  const expected = facts.filter(f => f.entity_id!.startsWith(`trade.${classification}1.`) && Number(f.year) === year && f.indicator_id === flow)
    .sort((a, b) => Number(b.value_usd) - Number(a.value_usd));
  // These accepted comparison ranges use billion USD with two decimal places.
  const unitLabel = new URL(page.url()).pathname.startsWith("/en/") ? "billion USD" : "მლრდ აშშ დოლარი";
  await expect(page.getByTestId("trade-partners-ranking").locator("thead th").nth(2)).toHaveText(unitLabel);
  for (const [index, fact] of expected.entries()) {
    await expect(rows.nth(index)).toHaveAttribute("data-entity-id", fact.entity_id!);
    const billions = Number(fact.value_usd) / 1_000_000_000;
    const amount = Number(billions.toFixed(2)) === 0 ? "<0.01" : new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(billions);
    await expect(rows.nth(index).locator("td").nth(1)).toHaveText(amount);
    await expect(rows.nth(index).locator("td").last()).toHaveText(`${(Number(fact.value_usd) / denominator * 100).toFixed(1).replace("-", "−")}%`);
  }
}

for (const prefix of ["", "/en"]) for (const width of [1440, 390]) {
  test(`composition defaults, global selection and readable layout ${prefix || "ka"} ${width}px`, async ({ page }) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${prefix}/explorer/trade/composition`);
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    await expect(page.getByTestId("trade-composition")).toHaveAttribute("data-section", "sitc");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "line");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "trade.exports");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "usd");
    await selected(page, 1, 11);
    await expect(toggle(page, "goods.total")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("series-row").first()).toHaveAttribute("data-series-id", "goods.total");
    await expect(page.getByTestId("range-start-handle")).toHaveAttribute("aria-valuenow", "2000");
    await expect(page.getByTestId("range-end-handle")).toHaveAttribute("aria-valuenow", "2025");
    await expect(page.getByTestId("trade-composition-tabs")).toHaveCount(1);
    await expect(page.getByTestId("trade-composition-tabs").getByRole("button")).toHaveCount(2);
    await expect(page.getByTestId("series-selector").getByTestId("trade-composition-tabs")).toHaveCount(1);
    for (const flow of ["trade.exports", "trade.imports"]) {
      const control = page.getByTestId(`trade-partners-measure-${flow}`);
      await expect(control).toHaveCount(1);
      expect(await control.evaluate(node => Boolean(node.closest('[data-testid="explorer-workspace"]')))).toBe(false);
      expect((await control.boundingBox())!.y).toBeLessThan((await page.getByTestId("explorer-workspace").boundingBox())!.y);
    }
    await expect(page.getByTestId("trade-partners-tab-countries")).toHaveCount(0);
    await expect(page.getByTestId("trade-partners-tab-groups")).toHaveCount(0);
    expect(await page.getByTestId("series-selector").locator('[data-selector-section]').evaluateAll(nodes => nodes.map(node => node.getAttribute("data-selector-section")))).toEqual(["search", "controls", "actions", "list"]);
    expect(await page.locator("h1").evaluate(heading => heading.nextElementSibling?.tagName)).toBe("P");
    await ranking(page, "sitc", "trade.exports");
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(artifacts, `${prefix ? "en" : "ka"}-${width}-viewport.png`) });
    await page.getByTestId("trade-composition").screenshot({ path: path.join(artifacts, `${prefix ? "en" : "ka"}-${width}-main.png`) });
    for (const classification of ["sitc", "bec"] as const) {
      await section(page, classification).click();
      const total = classification === "sitc" ? 11 : 8;
      const entity = entities.find(e => e.classification === classification)!;
      for (const query of [entity.sourceCode, entity.labelKa, entity.labelEn]) {
        await page.getByTestId("series-search").fill(query);
        await expect(toggle(page, entity.id)).toBeVisible();
      }
      await page.getByTestId("series-search").fill("no-matching-category-xyz");
      await expect(page.getByTestId("series-row")).toHaveCount(1);
      await page.getByTestId("series-toggle-all").click();
      await selected(page, 0, total);
      await expect(page.getByTestId("trade-partners-excel-download")).toBeDisabled();
      await ranking(page, classification, "trade.exports");
      await expect(page.getByTestId("range-start-handle")).toHaveAttribute("aria-valuenow", "2000");
      await page.getByTestId("series-toggle-all").focus();
      await page.keyboard.press("Space");
      await selected(page, total, total);
      await page.getByTestId("chart-mode-table").click();
      expect(await tableSeriesCount(page.getByTestId("explorer-table"))).toBe(total);
      expect(await tableSeriesValues(page.getByTestId("explorer-table"), prefix ? entity.labelEn : entity.labelKa)).toHaveLength(26);
      await page.getByTestId("series-search").fill("");
      if (!prefix) {
        expect(await page.getByTestId("series-row-toggle").evaluateAll(nodes => nodes.some(node => node.getBoundingClientRect().height > 44))).toBe(true);
      }
      await page.getByTestId("trade-partners-measure-trade.imports").focus();
      await page.keyboard.press("Enter");
      await ranking(page, classification, "trade.imports");
      await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "trade.imports");
      await page.getByTestId("chart-mode-line").click();
      await expect(page.getByTestId("chart-panel").locator('svg circle[r="3.5"]:not([stroke])')).toHaveCount(total);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}

for (const prefix of ["", "/en"]) {
  test(`keeps mobile classification focus visible after restoring line and table ${prefix || "ka"}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${prefix}/explorer/trade/composition#section=sitc&view=table`);
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
    const measurements = [];
    const focusArtifacts = path.join(artifacts, "focus-fix");
    await mkdir(focusArtifacts, { recursive: true });
    for (const [classification, mode] of [["bec", "line"], ["sitc", "table"]] as const) {
      await section(page, classification).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("trade-composition")).toHaveAttribute("data-section", classification);
      await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", mode);
      // Hash restoration is passive: measure only after the remembered mode and settled frames.
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      measurements.push(await section(page, classification).evaluate(node => {
        const rect = node.getBoundingClientRect();
        return { id: node.id, focused: document.activeElement === node, top: rect.top, bottom: rect.bottom, headerBottom: document.querySelector('[data-testid="data-sidebar"]')!.getBoundingClientRect().bottom, viewportHeight: innerHeight, scrollY };
      }));
      await page.screenshot({ path: path.join(focusArtifacts, `${prefix ? "en" : "ka"}-${classification}-${mode}-focus.png`) });
    }
    await writeFile(path.join(focusArtifacts, `${prefix ? "en" : "ka"}-focus-visibility.json`), JSON.stringify(measurements, null, 2));
    for (const measurement of measurements) {
      expect(measurement.focused).toBe(true);
      expect(measurement.top, `${measurement.id} must clear the sticky header`).toBeGreaterThanOrEqual(measurement.headerBottom);
      expect(measurement.bottom, `${measurement.id} must stay in the viewport`).toBeLessThanOrEqual(measurement.viewportHeight);
    }
  });
  test(`remembers each classification and restores shared links ${prefix || "ka"}`, async ({ page }) => {
    await page.goto(`${prefix}/explorer/trade/composition#section=sitc&view=table&measure=trade.imports&sel=goods.total,trade.sitc1.0&start=2010&end=2023`);
    await selected(page, 2, 11);
    const start = page.getByTestId("range-start-handle");
    await start.focus(); await start.press("ArrowRight");
    await expect(start).toBeFocused(); await expect(start).toHaveAttribute("aria-valuenow", "2011");
    const sitc = page.url();
    await section(page, "bec").focus(); await page.keyboard.press("Enter");
    await expect(section(page, "bec")).toBeFocused();
    await expect(page).toHaveURL(/section=bec/);
    await selected(page, 1, 8);
    await toggle(page, "trade.bec1.7").click();
    await page.getByTestId("chart-mode-table").click();
    const end = page.getByTestId("range-end-handle"); await end.focus(); await end.press("ArrowLeft");
    const bec = page.url();
    await section(page, "sitc").click(); await expect(page).toHaveURL(sitc);
    await expect(section(page, "sitc")).toBeFocused();
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "trade.imports");
    await expect(start).toHaveAttribute("aria-valuenow", "2011");
    await selected(page, 2, 11);
    await page.goBack(); await expect(page).toHaveURL(bec); await selected(page, 2, 8);
    await page.goForward(); await expect(page).toHaveURL(sitc); await selected(page, 2, 11);
    await page.reload(); await selected(page, 2, 11);
    await page.getByTestId("trade-composition-link").click(); await expect(page).toHaveURL(sitc);
    await language(page, prefix ? "ქართული" : "English");
    await selected(page, 2, 11);
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
    await expect(start).toHaveAttribute("aria-valuenow", "2011");
    await page.goto(`${prefix}/explorer/trade/composition#section=unsupported&measure=trade.balance&view=unsupported&sel=trade.bec1.1&start=1900&end=2099`);
    await expect(page.getByTestId("trade-composition")).toHaveAttribute("data-section", "sitc");
    await selected(page, 0, 11);
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "trade.exports");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "line");
    await expect(start).toHaveAttribute("aria-valuenow", "2000");
    await expect(end).toHaveAttribute("aria-valuenow", "2025");
  });
  test(`preserves explicit empty selection across history and language ${prefix || "ka"}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${prefix}/explorer/trade/composition#section=bec&view=table&measure=trade.imports&sel=&start=2015&end=2022`);
    await selected(page, 0, 8);
    await expect(page.getByTestId("no-selection-callout")).toBeVisible();
    await section(page, "sitc").click(); await page.goBack(); await selected(page, 0, 8);
    await page.reload(); await selected(page, 0, 8);
    await language(page, prefix ? "ქართული" : "English");
    await selected(page, 0, 8);
    await expect(page.getByTestId("trade-composition")).toHaveAttribute("data-section", "bec");
    await expect(page.getByTestId("trade-partners-excel-download")).toBeDisabled();
    await expect(page.getByTestId("range-start-handle")).toHaveAttribute("aria-valuenow", "2015");
    await expect(page.getByTestId("range-end-handle")).toHaveAttribute("aria-valuenow", "2022");
    await ranking(page, "bec", "trade.imports", 2022);
  });
}

test("switches classification without fetching datasets", async ({ page }) => {
  await page.goto("/en/explorer/trade/composition");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  // Finish initial sidebar route prefetches before measuring classification changes.
  await page.waitForLoadState("networkidle");
  const requests: string[] = [];
  page.on("request", request => { if (["fetch", "xhr"].includes(request.resourceType()) || /\.(csv|xlsx|json)(?:[?#]|$)|\/api\//.test(request.url())) requests.push(request.url()); });
  await section(page, "bec").click();
  await expect(page.getByTestId("trade-composition")).toHaveAttribute("data-section", "bec");
  await page.getByTestId("trade-partners-measure-trade.imports").click();
  await section(page, "sitc").click(); await page.goBack();
  await expect(page.getByTestId("trade-composition")).toHaveAttribute("data-section", "bec");
  await page.getByTestId("chart-mode-table").click();
  await page.waitForLoadState("networkidle");
  expect(requests).toEqual([]);
});

for (const classification of ["sitc", "bec"] as const) for (const flow of ["trade.exports", "trade.imports"]) {
  test(`exports the active classification and flow with original sources ${classification} ${flow}`, async ({ page, request }) => {
    test.setTimeout(60_000);
    const categories = entities.filter(e => e.classification === classification);
    await page.goto(`/en/explorer/trade/composition#section=${classification}&measure=${flow}`);
    await selected(page, 1, categories.length + 1);
    await page.getByTestId("series-search").fill(categories[0].labelEn);
    await page.getByTestId("series-toggle-all").click(); await page.getByTestId("series-toggle-all").click();
    await selected(page, categories.length + 1, categories.length + 1);
    const download = async () => {
      const pending = page.waitForEvent("download"); await page.getByTestId("trade-partners-excel-download").click();
      const file = await pending; expect(file.suggestedFilename()).toContain(`trade-composition-${classification}`);
      const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await file.path())!); return workbook;
    };
    const workbook = await download();
    expect(workbook.worksheets.map(sheet => sheet.name)).toEqual(["Summary", "Data", "Sources"]);
    const data = workbook.getWorksheet("Data")!;
    expect(data.columnCount).toBe(5); expect(data.rowCount).toBe((categories.length + 1) * 26 + 1);
    expect(data.getCell("D1").value).toBe("Amount (USD)");
    expect(JSON.stringify(data.getRow(1).values)).not.toMatch(/%|publication|entity_id|source_id|confidence|GEL|₾/i);
    expect(new Set(data.getColumn(1).values.slice(2))).toEqual(new Set(Array.from({ length: 26 }, (_, i) => 2000 + i)));
    for (const entity of categories) for (const fact of facts.filter(f => f.entity_id === entity.id && f.indicator_id === flow)) {
      const rows: ExcelJS.Row[] = []; data.eachRow(row => { if (row.getCell(1).value === Number(fact.year) && row.getCell(3).value === entity.labelEn) rows.push(row); });
      expect(rows).toHaveLength(1);
      expect(rows[0].getCell(4).value).toBe(fact.value_usd === "" ? null : Number(fact.value_usd));
      expect(rows[0].getCell(5).value).toBe(fact.value_usd === "" ? "Not available" : "Actual");
    }
    for (let year = 2000; year <= 2025; year++) {
      const row = data.getRow(2 + (year - 2000) * (categories.length + 1));
      expect(row.getCell(4).value).toBe(Number(national.find(f => Number(f.year) === year && f.indicator_id === flow)!.value_usd));
    }
    const filename = `${flow === "trade.exports" ? "export" : "import"}-${classification}${classification === "bec" && flow === "trade.imports" ? "-" : "_"}2000-2026.xlsx`;
    const links = (book: ExcelJS.Workbook) => {
      const result: string[] = []; book.getWorksheet("Sources")!.eachRow(row => row.eachCell(cell => {
        if (typeof cell.value === "object" && cell.value && "hyperlink" in cell.value) result.push(cell.value.hyperlink);
      })); return result;
    };
    const originalLinks = links(workbook);
    expect(originalLinks.map(link => new URL(link).pathname.split("/").at(-1)).sort()).toEqual([filename, "ftrade_1995-2026.xlsx"].sort());
    for (const link of originalLinks) {
      expect(link).toContain("https://fiscal.ge/downloads/methodology/trade/files/");
      const response = await request.get(new URL(link).pathname); expect(response.ok()).toBe(true);
      const local = await readFile(path.join(process.cwd(), "public", new URL(link).pathname));
      expect(createHash("sha256").update(await response.body()).digest("hex")).toBe(createHash("sha256").update(local).digest("hex"));
    }
    await toggle(page, "goods.total").click();
    const categoryOnly = await download(); expect(links(categoryOnly)).toHaveLength(1);
    expect(links(categoryOnly)[0]).toContain(filename);
    expect(categoryOnly.getWorksheet("Data")!.rowCount).toBe(categories.length * 26 + 1);
  });
}
