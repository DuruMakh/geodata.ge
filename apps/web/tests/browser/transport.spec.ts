import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";

const pressed = (id: string) => `[data-series-id="${id}"] [data-testid="series-row-toggle"]`;
const ticked = (page: Page) => page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]');
const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
const TOPICS = ["vehicles", "vehicle-age", "passengers", "freight"];

/** The table cell of the row labelled `label` in the `year` column (the wide, year-columns layout). */
async function cell(page: Page, label: string, year: number) {
  const table = page.getByTestId("explorer-table");
  const column = (await table.locator("thead th").allInnerTexts()).findIndex(text => text.trim().startsWith(String(year)));
  expect(column).toBeGreaterThan(0);
  // The row label is the row's <th>, so value cells start one column earlier.
  return table.locator("tbody tr", { hasText: label }).locator("td").nth(column - 1);
}

test("the hub shows five cards, each opening its page", async ({ page }) => {
  await page.goto("/explorer/transport");
  const hub = page.getByTestId("transport-hub");
  await expect(hub.getByTestId("hub-card")).toHaveCount(5);
  expect(await hub.locator("a").evaluateAll(links => links.map(link => link.getAttribute("href")))).toEqual([...TOPICS, "regions"].map(section => `/explorer/transport/${section}`));
  await expect(page.getByTestId("transport-link")).toHaveAttribute("aria-current", "page");
});

const DEFAULTS = [
  { section: "vehicles", id: "transport.fleet.cars", latest: "მსუბუქი ავტომობილები · 2025: 1.65 მლნ" },
  { section: "vehicle-age", id: "transport.fleet.cars_age_over_10", latest: "10+ წლის ავტომობილები · 2025: 1.32 მლნ" },
  { section: "passengers", id: "transport.passenger_km.total", latest: "მგზავრთბრუნვა · 2025: 11.3 მლრდ" },
  { section: "freight", id: "transport.tonne_km.total", latest: "ტვირთბრუნვა · 2025: 5.1 მლრდ" },
];
for (const { section, id, latest } of DEFAULTS) test(`${section} opens on its default row, with the latest line on one line of a 375px screen`, async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(`/explorer/transport/${section}`);
  await ready(page);
  const line = page.getByTestId("transport-latest");
  await expect(line).toHaveText(latest);
  expect(await line.evaluate(element => element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight))).toBeLessThanOrEqual(1.1);
  await expect(ticked(page)).toHaveCount(1);
  await expect(page.locator(pressed(id))).toHaveAttribute("aria-pressed", "true");
  // No tab row or measure switch, and the one source line.
  await expect(page.locator('[data-testid^="transport-measure-"]')).toHaveCount(0);
  await expect(page.getByTestId("source-label")).toContainText("საქსტატი");
});

test("vehicles lists the types and each type's fuels, and a year Geostat left blank is a dash", async ({ page }) => {
  await page.goto("/explorer/transport/vehicles");
  await ready(page);
  await expect(page.getByTestId("series-heading")).toHaveText([
    "ავტომობილები ტიპის მიხედვით · ათასი", "მსუბუქი ავტომობილები საწვავის მიხედვით · ათასი", "ავტობუსები და მიკროავტობუსები საწვავის მიხედვით · ათასი",
    "სატვირთო ავტომობილები საწვავის მიხედვით · ათასი", "სპეციალური ავტომობილები საწვავის მიხედვით · ათასი",
  ]);
  await expect(page.getByTestId("year-range-strip")).toContainText("2000–2025");
  await page.getByTestId("chart-mode-table").click();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  await expect(await cell(page, "მსუბუქი ავტომობილები", 2004)).toHaveText("—");
  await expect(await cell(page, "მსუბუქი ავტომობილები", 2025)).toHaveText("1,650.0");
});

test("passengers: ticking Metro under passengers carried replaces all transport, and the years become Metro's", async ({ page }) => {
  await page.goto("/explorer/transport/passengers");
  await ready(page);
  await expect(page.getByTestId("series-heading")).toHaveText(["მგზავრთბრუნვა · მლნ მგზავრ-კმ", "მგზავრთბრუნვა ერთ სულზე · მგზავრ-კმ", "გადაყვანილი მგზავრები · ათასი"]);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "pkm");
  await expect(page.getByTestId("year-range-strip")).toContainText("2000–2025");
  await page.locator(pressed("transport.passengers.metro")).click();
  await expect(ticked(page)).toHaveCount(1);
  await expect(page.locator(pressed("transport.passenger_km.total"))).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "passengers");
  await expect(page.getByTestId("transport-unit-label")).toHaveText("ათასი მგზავრი");
  await expect(page.getByTestId("year-range-strip")).toContainText("2012–2025");
  // The latest line stays the page's headline.
  await expect(page.getByTestId("transport-latest")).toHaveText("მგზავრთბრუნვა · 2025: 11.3 მლრდ");
});

test("the language switch keeps the selection, years and table mode on freight", async ({ page }) => {
  await page.goto("/explorer/transport/freight#view=table&start=2010&end=2025&sel=transport.tonne_km.rail,transport.tonne_km.road");
  await ready(page);
  await expect(ticked(page)).toHaveCount(2);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  const hash = new URL(page.url()).hash;
  await page.getByTestId("language-switch").first().getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/transport\/freight#/);
  expect(new URL(page.url()).hash).toBe(hash);
  await ready(page);
  await expect(page.getByTestId("transport-latest")).toHaveText("Tonne-km · 2025: 5.1 billion");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  await expect(ticked(page)).toHaveCount(2);
  await expect(page.getByTestId("series-heading")).toHaveText(["Tonne-km · million", "Goods carried · thousand tonnes"]);
});

test("the topic Excel download is a workbook citing the archived Geostat files", async ({ page }) => {
  await page.goto("/explorer/transport/vehicle-age");
  await ready(page);
  const promise = page.waitForEvent("download");
  await page.getByTestId("transport-excel-download").click();
  const download = await promise;
  expect(download.suggestedFilename()).toMatch(/^fiscal-transport-vehicle-age-2017-2025\.xlsx$/);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await download.path())!);
  expect(workbook.worksheets).toHaveLength(3);
  const links: string[] = [];
  workbook.worksheets[2].eachRow(row => row.eachCell(cell => { const value = cell.value as { hyperlink?: string } | null; if (value && typeof value === "object" && value.hyperlink) links.push(value.hyperlink); }));
  expect(links.length).toBeGreaterThan(0);
  for (const link of links) expect(link).toContain("/downloads/methodology/transport/files/");
});

test("regions is the map and list with Georgia first, and the map opens Tbilisi's page", async ({ page }) => {
  await page.goto("/explorer/transport/regions");
  await ready(page);
  await expect(page.getByTestId("transport-latest")).toHaveText("რეგისტრირებული ავტომობილები · თბილისი · 2025: 855.0 ათასი");
  await expect(page.getByTestId("transport-region-map").getByTestId("regional-map-path")).toHaveCount(11);
  const rows = page.getByTestId("regional-list-row");
  await expect(rows).toHaveCount(12);
  await expect(rows.first()).toHaveAttribute("href", "/explorer/transport/regions/georgia");
  await expect(rows.first()).toContainText("1,914.9");
  await expect(rows.nth(1)).toHaveAttribute("data-region-id", "region.tbilisi");
  for (const id of ["chart-panel", "transport-excel-download", "source-label"]) await expect(page.getByTestId(id)).toHaveCount(0);
  const tbilisi = page.getByTestId("transport-region-map").locator('a[data-region-id="region.tbilisi"]');
  await expect(tbilisi).toHaveAttribute("href", "/explorer/transport/regions/tbilisi");
  await tbilisi.click({ force: true });
  await expect(page).toHaveURL(/\/explorer\/transport\/regions\/tbilisi$/);
  await ready(page);
  await expect(page.locator(pressed("transport.registered.region_tbilisi"))).toHaveAttribute("aria-pressed", "true");
});

test("an area page: headings, picker and neighbours carry a Roads selection, the language switch keeps it, and Excel", async ({ page }) => {
  await page.goto("/explorer/transport/regions/imereti");
  await ready(page);
  await expect(page.getByRole("heading", { level: 1 }).getByTestId("region-picker-trigger")).toHaveText("იმერეთი");
  await expect(page.getByTestId("series-heading")).toHaveText(["რეგისტრირებული ავტომობილები · ათასი", "საწვავის მიხედვით · ათასი", "ასაკის მიხედვით · ათასი", "მფლობელის მიხედვით · ათასი", "გზები · კმ"]);
  await expect(page.getByTestId("year-range-strip")).toContainText("2017–2025");
  // Ticking a road row replaces the vehicles (another unit); the years become the roads'.
  await page.locator(pressed("transport.road_km.region_imereti_local")).click();
  await expect(ticked(page)).toHaveCount(1);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "km");
  await expect(page.getByTestId("year-range-strip")).toContainText("2011–2024");
  await page.getByTestId("region-picker-trigger").click();
  await expect(page.getByTestId("region-picker-option")).toHaveCount(12);
  await expect(page.getByTestId("region-picker-option").first()).toHaveText("საქართველო");
  const guria = page.getByTestId("region-picker-option").filter({ hasText: "გურია" });
  await expect(guria).toHaveAttribute("href", "/explorer/transport/regions/guria#sel=transport.road_km.region_guria_local");
  await guria.click();
  await expect(page).toHaveURL(/\/explorer\/transport\/regions\/guria#sel=transport\.road_km\.region_guria_local$/);
  await ready(page);
  await expect(page.getByTestId("transport-latest")).toHaveText("რეგისტრირებული ავტომობილები · 2025: 40.7 ათასი · გურია");
  await expect(page.locator(pressed("transport.road_km.region_guria_local"))).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("language-switch").first().getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/transport\/regions\/guria#sel=transport\.road_km\.region_guria_local$/);
  await ready(page);
  await expect(page.getByTestId("region-picker-trigger")).toHaveText("Guria");
  await expect(page.locator(pressed("transport.road_km.region_guria_local"))).toHaveAttribute("aria-pressed", "true");
  const promise = page.waitForEvent("download");
  await page.getByTestId("transport-excel-download").click();
  const download = await promise;
  expect(download.suggestedFilename()).toMatch(/^fiscal-transport-guria-2011-2024-en\.xlsx$/);
});

for (const prefix of ["", "/en"]) test(`the methodology link opens the transport methodology with its original files ${prefix || "ka"}`, async ({ page }) => {
  await page.goto(`${prefix}/explorer/transport/passengers`);
  await ready(page);
  await page.getByTestId("source-label").getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`${prefix}/methodology/transport$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(prefix ? "Transport" : "ტრანსპორტი");
  await expect(page.locator("main")).toContainText(prefix ? "should not be added together" : "არ უნდა შეიკრიბოს");
  const archived = page.locator('a[href^="/downloads/methodology/transport/files/"]');
  expect(await archived.count()).toBeGreaterThan(0);
  const response = await page.request.get(await archived.first().getAttribute("href") as string);
  expect(response.status()).toBe(200);
});

for (const width of [390, 768]) for (const prefix of ["", "/en"]) test(`transport pages fit a ${width}px screen ${prefix || "ka"}`, async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width, height: 900 });
  for (const path of ["/explorer/transport", ...TOPICS.map(section => `/explorer/transport/${section}`), "/explorer/transport/regions", "/explorer/transport/regions/guria"]) {
    await page.goto(`${prefix}${path}`);
    if (path !== "/explorer/transport") await ready(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
  }
  expect(errors).toEqual([]);
});
