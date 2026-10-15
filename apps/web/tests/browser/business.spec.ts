import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";

const pressed = (id: string) => `[data-series-id="${id}"] [data-testid="series-row-toggle"]`;
const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
const row = (page: Page, id: string) => page.locator(`[data-testid="regional-list-row"][data-region-id="${id}"]`);
const TOPICS = ["sales", "jobs", "investment-profit", "firms"];
/** Every cell of a sheet as text, a hyperlink cell as its link. */
const sheetText = (sheet: ExcelJS.Worksheet) => {
  const values: string[] = [];
  sheet.eachRow(row => row.eachCell(cell => { values.push(cell.type === ExcelJS.ValueType.Hyperlink ? (cell.value as ExcelJS.CellHyperlinkValue).hyperlink : String(cell.value)); }));
  return values.join("\n");
};

/** The table cell of the row labelled `label` in the `year` column (the wide, year-columns layout). */
async function cell(page: Page, label: string, year: number) {
  const table = page.getByTestId("explorer-table");
  const column = (await table.locator("thead th").allInnerTexts()).findIndex(text => text.trim().startsWith(String(year)));
  expect(column).toBeGreaterThan(0);
  // The row label is the row's <th>, so value cells start one column earlier.
  return table.locator("tbody tr", { hasText: label }).locator("td").nth(column - 1);
}

test("the hub shows five cards, each opening its page", async ({ page }) => {
  await page.goto("/explorer/business");
  const hub = page.getByTestId("business-hub");
  await expect(hub.getByTestId("hub-card")).toHaveCount(5);
  expect(await hub.locator("a").evaluateAll(links => links.map(link => link.getAttribute("href")))).toEqual([...TOPICS, "regions"].map(section => `/explorer/business/${section}`));
  await expect(page.getByTestId("business-link")).toHaveAttribute("aria-current", "page");
});

test("sales selects all firms alone and lists sizes and industries under two headings", async ({ page }) => {
  await page.goto("/explorer/business/sales");
  await ready(page);
  await expect(page.getByTestId("business-latest")).toHaveText("საწარმოების ბრუნვა · 2025: 253.7 მლრდ ₾");
  // The chart, table and list read in million GEL to one decimal; the line keeps billion GEL.
  await expect(page.getByTestId("business-unit-label")).toHaveText("მლნ ₾");
  await expect(page.locator('[data-series-id="business.turnover.total"]')).toContainText("253,725.5");
  await expect(page.getByTestId("series-status")).toContainText("1 / 18");
  await expect(page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator(pressed("business.turnover.total"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("series-heading")).toHaveText(["საწარმოს ზომა", "დარგი"]);
  // Each heading names the group of its rows for a screen reader.
  await expect(page.getByRole("group", { name: "საწარმოს ზომა" }).locator('[data-testid="series-row"]')).toHaveCount(3);
  await expect(page.getByRole("group", { name: "დარგი" }).locator('[data-testid="series-row"]')).toHaveCount(14);
  // One page, one list: no measure switch, and the one source line.
  await expect(page.locator('[data-testid^="business-measure-"]')).toHaveCount(0);
  await expect(page.getByTestId("year-range-strip")).toContainText("1999–2025");
  await expect(page.getByTestId("source-label")).toContainText("საქსტატი");
  // A search hides a heading with no matching row.
  await page.getByTestId("series-search").fill("მშენ");
  await expect(page.getByTestId("series-heading")).toHaveText(["დარგი"]);
  await expect(page.getByTestId("business-latest")).toContainText("253.7");
});

test("jobs reads in thousand people", async ({ page }) => {
  await page.goto("/en/explorer/business/jobs");
  await ready(page);
  await expect(page.getByTestId("business-latest")).toHaveText("People employed in firms · 2025: 899.0 thousand");
  await expect(page.getByTestId("business-unit-label")).toHaveText("thousand people");
  await expect(page.getByTestId("series-heading")).toHaveText(["Firm size", "Industry"]);
});

test("a section death rate Geostat did not publish is a dash in the table, never zero", async ({ page }) => {
  await page.goto("/explorer/business/firms#view=table&sel=business.death_rate.sector_c");
  await ready(page);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "percent");
  for (const year of [2016, 2019]) await expect(await cell(page, "დამამუშავებელი მრეწველობა", year)).toHaveText("—");
  await expect(await cell(page, "დამამუშავებელი მრეწველობა", 2017)).toHaveText(/^\d+\.\d%$/);
});

test("investment and profit has no measure switch and its search opens the nested rows", async ({ page }) => {
  await page.goto("/explorer/business/investment-profit");
  await ready(page);
  await expect(page.locator('[data-testid^="business-measure-"]')).toHaveCount(0);
  await expect(page.getByTestId("series-status")).toContainText("1 / 3");
  await expect(page.locator(pressed("business.investment.total"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("year-range-strip")).toContainText("2006–2025");
  await page.getByTestId("series-search").fill("მშენ");
  for (const measure of ["investment", "profit", "loss"]) await expect(page.locator(`[data-series-id="business.${measure}.sector_f"]`)).toBeVisible();
  await expect(page.getByTestId("series-status")).toContainText("1 / 3");
});

test("outside the list a nested series carries its parent's name, and amounts read in million GEL to one decimal", async ({ page }) => {
  await page.goto("/explorer/business/investment-profit#view=table&sel=business.investment.sector_f,business.profit.sector_f");
  await ready(page);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  const labels = (await page.getByTestId("explorer-table").locator("tbody th").allInnerTexts()).map(text => text.trim());
  expect(labels).toEqual(expect.arrayContaining(["ინვესტიციები ფიქსირებულ აქტივებში — მშენებლობა", "მოგება — მშენებლობა"]));
  // The list keeps the short name under its parent.
  await expect(page.locator('[data-series-id="business.profit.sector_f"]')).toContainText("მშენებლობა");
  await expect(page.locator('[data-series-id="business.profit.sector_f"]')).not.toContainText("მოგება —");
  for (const name of ["ინვესტიციები ფიქსირებულ აქტივებში — მშენებლობა", "მოგება — მშენებლობა"]) await expect(await cell(page, name, 2025)).toHaveText(/^\d{1,3}(,\d{3})*\.\d$/);
  // No cell of the three measures reads below the unit.
  await page.goto("/explorer/business/investment-profit#view=table&sel=business.investment.size_small,business.profit.sector_a,business.loss.sector_r");
  await ready(page);
  await expect(page.getByTestId("explorer-table")).not.toContainText("<0.1");
});

test("the same industry under two parents keeps its colour and takes its parent's stroke", async ({ page }) => {
  await page.goto("/explorer/business/investment-profit#sel=business.investment.sector_f,business.profit.sector_f,business.loss.sector_f");
  await ready(page);
  const chart = page.getByTestId("chart-panel");
  await expect(chart.locator('[data-testid="chart-series-business.profit.sector_f-dashed"]').first()).toHaveAttribute("stroke-dasharray", "6 5");
  await expect(chart.locator('[data-testid="chart-series-business.loss.sector_f-dotted"]').first()).toBeAttached();
  await expect(chart.locator('[data-testid^="chart-series-business.investment.sector_f-"]')).toHaveCount(0);
  const strokes = await chart.locator('[data-testid^="chart-series-business.profit.sector_f"], [data-testid^="chart-series-business.loss.sector_f"]').evaluateAll(paths => [...new Set(paths.map(path => path.getAttribute("stroke")))]);
  expect(strokes).toHaveLength(1);
});

test("firms lists counts and rates under two headings, and ticking a rate replaces the counts", async ({ page }) => {
  await page.goto("/explorer/business/firms");
  await ready(page);
  await expect(page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(2);
  await expect(page.getByTestId("business-latest")).toContainText("2024");
  await expect(page.getByTestId("business-latest")).toContainText("56,259");
  await expect(page.getByTestId("business-latest")).toContainText("29,634");
  // No measure switch: one list holds the counts and the rates, each unit under its heading.
  await expect(page.locator('[data-testid^="business-measure-"]')).toHaveCount(0);
  await expect(page.getByTestId("chart-panel").locator("svg.lucide-building2, svg.lucide-building-2, svg.lucide-percent")).toHaveCount(0);
  await expect(page.getByTestId("series-heading")).toHaveText(["რაოდენობა", "აქტიურ საწარმოებთან შეფარდებით · %"]);
  await expect(page.getByRole("group", { name: "რაოდენობა" }).locator('[data-series-id$=".total"]')).toHaveCount(3);
  await expect(page.getByTestId("series-status")).toContainText("2 / 5");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "enterprises");
  // Each row reads in its own unit at the end year: whole firms, rates to one decimal.
  await expect(page.locator('[data-series-id="business.births.total"]')).toContainText("56,259");
  await expect(page.locator('[data-series-id="business.birth_rate.total"] [data-testid="series-row-toggle"]')).toHaveText(/\d+\.\d/);
  await page.locator(pressed("business.birth_rate.total")).click();
  await expect(page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator(pressed("business.birth_rate.total"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "percent");
  await expect(page.getByTestId("business-unit-label")).toHaveText("%");
  // Ticking another rate adds it; the headline stays.
  await page.locator(pressed("business.death_rate.total")).click();
  await expect(page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(2);
  await expect(page.getByTestId("business-latest")).toContainText("56,259");
  await expect(page).toHaveURL(/#view=line&sel=business\.birth_rate\.total%2Cbusiness\.death_rate\.total/);
  // The language switch keeps the selection.
  await page.getByTestId("language-switch").first().getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/business\/firms#view=line&sel=business\.birth_rate\.total/);
  await ready(page);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "percent");
  await expect(page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(2);
  await expect(page.getByTestId("series-heading")).toHaveText(["Number", "Compared with active firms · %"]);
  // Clearing and selecting all takes the counts only.
  await page.getByTestId("series-toggle-all").click();
  await expect(page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(0);
  await page.getByTestId("series-toggle-all").click();
  await expect(page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(3);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "enterprises");
});

test("regions is the map and list with Georgia first, and a region opens with the jobs choice", async ({ page }) => {
  await page.goto("/explorer/business/regions");
  await ready(page);
  await expect(page.getByTestId("business-latest")).toContainText("თბილისი");
  await expect(page.getByTestId("business-latest")).toHaveText("ბრუნვა · თბილისი · 2025: 200.8 მლრდ ₾");
  await expect(page.getByTestId("business-region-map").getByTestId("regional-map-path")).toHaveCount(11);
  const rows = page.getByTestId("regional-list-row");
  await expect(rows).toHaveCount(12);
  await expect(rows.first()).toHaveAttribute("data-region-id", "georgia");
  await expect(rows.first()).toContainText("საქართველო");
  await expect(rows.first()).toHaveAttribute("href", "/explorer/business/regions/georgia");
  // Every sales value reads in billion GEL to one decimal.
  for (const text of await rows.allInnerTexts()) expect(text).toMatch(/(\d+\.\d|<0\.1) მლრდ ₾/);
  await expect(rows.nth(1)).toHaveAttribute("data-region-id", "region.tbilisi");
  await expect(row(page, "region.guria")).toHaveAttribute("href", "/explorer/business/regions/guria");
  for (const id of ["chart-panel", "series-status", "business-excel-download", "source-label"]) await expect(page.getByTestId(id)).toHaveCount(0);
  await expect(page.getByTestId("regional-source-note")).toContainText("geoBoundaries");
  await page.getByTestId("business-map-employed").click();
  await expect(page.getByTestId("business-region-index")).toHaveAttribute("data-measure", "employed");
  await expect(page).toHaveURL(/\/explorer\/business\/regions#m=jobs$/);
  await expect(rows.first()).toContainText("899.0");
  await expect(page.getByTestId("business-region-map").locator('a[data-region-id="region.guria"]')).toHaveAttribute("href", "/explorer/business/regions/guria#sel=business.employed.region_guria");
  await expect(rows.first()).toHaveAttribute("href", "/explorer/business/regions/georgia#sel=business.employed.total");
  await row(page, "region.guria").click();
  await expect(page).toHaveURL(/\/explorer\/business\/regions\/guria#sel=business\.employed\.region_guria$/);
  await ready(page);
  await expect(page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator(pressed("business.employed.region_guria"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "persons");
});

test("the Guria page: picker, neighbours, the one list, the language switch and Excel", async ({ page }) => {
  await page.goto("/explorer/business/regions/guria");
  await ready(page);
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toContainText("ბიზნესი —");
  await expect(heading.getByTestId("region-picker-trigger")).toHaveText("გურია");
  // Guria's sales reach a billion: the line reads in billion GEL, while the chart and the list read in million GEL to one decimal.
  await expect(page.getByTestId("business-latest")).toHaveText(/^ბრუნვა · 2025: 1\.\d მლრდ ₾ · გურია$/);
  await expect(page.getByTestId("business-unit-label")).toHaveText("მლნ ₾");
  await expect(page.locator('[data-series-id="business.turnover.region_guria"]')).toContainText("1,078.7");
  // No measure switch: money, jobs and firms are one list under three headings, each naming its unit.
  await expect(page.locator('[data-testid^="business-area-measure-"]')).toHaveCount(0);
  await expect(page.getByTestId("series-heading")).toHaveText(["ბრუნვა, ინვესტიციები, მოგება და ზარალი · მლნ ₾", "დასაქმებულები · ათასი ადამიანი", "საწარმოების რაოდენობა"]);
  await expect(page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator(pressed("business.turnover.region_guria"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("year-range-strip")).toContainText("2006–2025");
  await expect(page.getByTestId("source-label")).toContainText("სათაო ოფისი");
  // The picker lists Georgia first and returns to the index.
  await page.getByTestId("region-picker-trigger").click();
  await expect(page.getByTestId("region-picker-option")).toHaveCount(12);
  await expect(page.getByTestId("region-picker-option").first()).toHaveText("საქართველო");
  await expect(page.getByTestId("region-picker-all-option")).toHaveAttribute("href", "/explorer/business/regions");
  await page.keyboard.press("Escape");
  // Previous and next follow Georgia, then the regions' order.
  const navigation = page.getByTestId("business-region-navigation");
  await expect(navigation.getByRole("link")).toHaveText(["← აჭარა", "იმერეთი →"]);
  await expect(navigation.getByRole("link").last()).toHaveAttribute("href", "/explorer/business/regions/imereti");
  // Ticking a firm count replaces sales; firms run 2014–2024.
  await page.locator(pressed("business.births.region_guria")).click();
  await page.locator(pressed("business.deaths.region_guria")).click();
  await expect(page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(2);
  await expect(page.locator(pressed("business.turnover.region_guria"))).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "enterprises");
  await expect(page.getByTestId("year-range-strip")).toContainText("2014–2024");
  await expect(page).toHaveURL(/#view=line&sel=business\.births\.region_guria%2Cbusiness\.deaths\.region_guria/);
  // Links to another area carry the selection, moved to that area.
  await expect(navigation.getByRole("link").last()).toHaveAttribute("href", "/explorer/business/regions/imereti#sel=business.births.region_imereti%2Cbusiness.deaths.region_imereti");
  const promise = page.waitForEvent("download");
  await page.getByTestId("business-excel-download").click();
  const download = await promise;
  expect(download.suggestedFilename()).toMatch(/^fiscal-business-guria-2014-2024\.xlsx$/);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await download.path())!);
  // The Sources sheet links the archived business demography workbook the firm counts come from, and nothing else.
  expect(sheetText(workbook.worksheets[2])).toContain("https://fiscal.ge/downloads/methodology/business/files/main-results.xlsx");
  expect(sheetText(workbook.worksheets[2])).not.toContain("0502en0101_turnover.xlsx");
  // The language switch keeps the selection.
  await page.getByTestId("language-switch").first().getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/business\/regions\/guria#view=line&sel=business\.births\.region_guria/);
  await ready(page);
  await expect(page.getByTestId("region-picker-trigger")).toHaveText("Guria");
  await expect(page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(2);
  await expect(page.getByTestId("year-range-strip")).toContainText("2014–2024");
  await page.getByTestId("business-region-navigation").getByRole("link", { name: "Imereti →" }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/business\/regions\/imereti#sel=business\.births\.region_imereti%2Cbusiness\.deaths\.region_imereti$/);
  await ready(page);
  await expect(page.locator(pressed("business.deaths.region_imereti"))).toHaveAttribute("aria-pressed", "true");
});

test("on an area page, ticking Employed replaces Sales and the all-regions link opens the jobs map", async ({ page }) => {
  await page.goto("/explorer/business/regions/guria");
  await ready(page);
  await page.locator(pressed("business.employed.region_guria")).click();
  await expect(page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator(pressed("business.employed.region_guria"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "persons");
  await expect(page.getByTestId("business-unit-label")).toHaveText("ათასი ადამიანი");
  await expect(page.getByTestId("year-range-strip")).toContainText("2006–2025");
  await page.getByTestId("region-picker-trigger").click();
  await expect(page.getByTestId("region-picker-all-option")).toHaveAttribute("href", "/explorer/business/regions#m=jobs");
});

test("an area whose sales stay under a billion reads in million GEL, in the line and the chart alike, as Georgia's chart does", async ({ page }) => {
  await page.goto("/explorer/business/regions/racha_lechkhumi_kvemo_svaneti");
  await ready(page);
  await expect(page.getByTestId("business-latest")).toHaveText(/^ბრუნვა · 2025: [\d.]+ მლნ ₾ · /);
  await expect(page.getByTestId("business-unit-label")).toHaveText("მლნ ₾");
  await page.goto("/explorer/business/regions/georgia");
  await ready(page);
  await expect(page.getByTestId("business-latest")).toHaveText(/^ბრუნვა · 2025: 253\.7 მლრდ ₾ · /);
  await expect(page.getByTestId("business-unit-label")).toHaveText("მლნ ₾");
});

test("the topic Excel download is a workbook", async ({ page }) => {
  await page.goto("/explorer/business/sales");
  await ready(page);
  const promise = page.waitForEvent("download");
  await page.getByTestId("business-excel-download").click();
  const download = await promise;
  expect(download.suggestedFilename()).toMatch(/^fiscal-business-sales-1999-2025\.xlsx$/);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await download.path())!);
  expect(workbook.worksheets).toHaveLength(3);
  // The Sources sheet links the archived Geostat turnover workbook behind all firms' sales.
  expect(sheetText(workbook.worksheets[2])).toContain("https://fiscal.ge/downloads/methodology/business/files/0502en0101_turnover.xlsx");
  expect(sheetText(workbook.worksheets[2])).not.toContain("main-results.xlsx");
});

for (const prefix of ["", "/en"]) test(`business pages fit a 390px screen ${prefix || "ka"}`, async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 900 });
  for (const path of ["/explorer/business", ...TOPICS.map(section => `/explorer/business/${section}`), "/explorer/business/regions", "/explorer/business/regions/guria"]) {
    await page.goto(`${prefix}${path}`);
    if (path !== "/explorer/business") await ready(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
  }
  expect(errors).toEqual([]);
});
