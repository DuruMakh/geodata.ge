import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";

const pressed = (id: string) => `[data-series-id="${id}"] [data-testid="series-row-toggle"]`;
const ticked = (page: Page) => page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]');
const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
const tickedIds = (page: Page) => ticked(page).evaluateAll(toggles => toggles.map(toggle => toggle.closest("[data-series-id]")!.getAttribute("data-series-id")));
const SECTIONS = ["greenhouse-gases", "air-pollution", "air-quality", "climate", "water", "waste", "forests"];
const POLLUTANTS = ["co", "nox", "so2", "nh3", "nmvoc", "tsp", "pm10", "pm25"];

/** The table cell of the row labelled `label` in the `year` column (the wide, year-columns layout). */
async function cell(page: Page, label: string, year: number) {
  const table = page.getByTestId("explorer-table");
  const column = (await table.locator("thead th").allInnerTexts()).findIndex(text => text.trim().startsWith(String(year)));
  expect(column).toBeGreaterThan(0);
  // The row label is the row's <th>, so value cells start one column earlier.
  return table.locator("tbody tr", { hasText: label }).locator("td").nth(column - 1);
}

test("the hub shows seven cards, each opening its page, and sits after Energy and food in the menu", async ({ page }) => {
  await page.goto("/explorer/environment");
  const hub = page.getByTestId("environment-hub");
  await expect(hub.getByTestId("hub-card")).toHaveCount(7);
  expect(await hub.locator("a").evaluateAll(links => links.map(link => link.getAttribute("href")))).toEqual(SECTIONS.map(section => `/explorer/environment/${section}`));
  await expect(page.getByTestId("environment-link")).toHaveAttribute("aria-current", "page");
  const hubs = await page.locator('[data-testid$="-link"][href^="/explorer/"]').evaluateAll(links => links.map(link => link.getAttribute("href")));
  expect(hubs[hubs.indexOf("/explorer/energy-food") + 1]).toBe("/explorer/environment");
});

test("greenhouse gases select the total and list six headings, with no measure switch", async ({ page }) => {
  await page.goto("/explorer/environment/greenhouse-gases");
  await ready(page);
  await expect(page.getByTestId("environment-latest")).toHaveText("სათბურის გაზები · 2022: 20.1 მლნ ტ CO₂ ეკვ.");
  await expect(page.getByTestId("series-heading")).toHaveText([
    "ჯამური ემისიები · მლნ ტ CO₂ ეკვ.", "სექტორების მიხედვით · მლნ ტ CO₂ ეკვ.", "ენერგეტიკა დეტალურად · მლნ ტ CO₂ ეკვ.",
    "გაზების მიხედვით · მლნ ტ CO₂ ეკვ.", "ფტორიანი გაზები · ათასი ტ CO₂ ეკვ.", "ერთ სულ მოსახლეზე · ტ CO₂ ეკვ.",
  ]);
  expect(await tickedIds(page)).toEqual(["environment.ghg.total"]);
  await expect(page.getByTestId("series-status")).toContainText("1 / 16");
  await expect(page.getByTestId("year-range-strip")).toContainText("2000–2022");
  await expect(page.locator('[data-testid^="environment-measure-"]')).toHaveCount(0);
  await expect(page.getByTestId("source-label")).toContainText("საქსტატი");
  // Ticking the fluorinated gases replaces the totals: the chart keeps one unit.
  await page.locator(pressed("environment.ghg.gas_hfcs")).click();
  expect(await tickedIds(page)).toEqual(["environment.ghg.gas_hfcs"]);
  await expect(page.getByTestId("environment-unit-label")).toHaveText("ათასი ტ CO₂ ეკვ.");
  await expect(page.getByTestId("environment-latest")).toContainText("20.1");
});

test("air pollution selects the eight pollutant totals, each under its own heading", async ({ page }) => {
  await page.goto("/explorer/environment/air-pollution");
  await ready(page);
  await expect(page.getByTestId("environment-latest")).toHaveText("მხუთავი აირი (CO) · 2024: 86.4 ათასი ტონა");
  await expect(page.getByTestId("series-heading")).toHaveCount(8);
  expect(await tickedIds(page)).toEqual(POLLUTANTS.map(pollutant => `environment.air.${pollutant}.total`));
  await expect(page.getByTestId("series-status")).toContainText("8 / 24");
  await expect(page.getByTestId("year-range-strip")).toContainText("2013–2024");
});

test("city air quality is nine city cards, and a card opens its city's page", async ({ page }) => {
  await page.goto("/explorer/environment/air-quality");
  await ready(page);
  await expect(page.getByTestId("environment-latest")).toHaveText("რუსთავი, PM10 · 2025: 51 მკგ/მ³");
  const cards = page.getByTestId("environment-city-cards").getByTestId("hub-card");
  await expect(cards).toHaveCount(9);
  expect(await page.getByTestId("environment-city-cards").locator("a").evaluateAll(links => links.map(link => link.getAttribute("href"))))
    .toEqual(["tbilisi", "kutaisi", "batumi", "rustavi", "zestaponi", "zugdidi", "akhaltsikhe", "telavi", "mestia"].map(city => `/explorer/environment/air-quality/${city}`));
  await cards.first().click();
  await expect(page).toHaveURL(/\/explorer\/environment\/air-quality\/tbilisi$/);
});

test("the Tbilisi page: every station's PM10 and the dashed limit, the picker and the neighbours", async ({ page }) => {
  await page.goto("/explorer/environment/air-quality/tbilisi");
  await ready(page);
  await expect(page.getByRole("heading", { level: 1 }).getByTestId("city-picker-trigger")).toHaveText("თბილისი");
  await expect(page.getByTestId("environment-latest")).toHaveText("ვარკეთილი, PM10 · 2025: 31 მკგ/მ³");
  expect(await tickedIds(page)).toEqual([1, 2, 3, 4, 5].map(n => `environment.aq.pm10_avg.tbilisi_a${n}`).concat("environment.aq.pm10_limit.tbilisi"));
  await expect(page.getByTestId("series-heading")).toHaveCount(4);
  await expect(page.getByTestId("chart-panel").locator('[data-testid="chart-series-environment.aq.pm10_limit.tbilisi-dashed"]').first()).toHaveAttribute("stroke-dasharray", "6 5");
  await page.getByTestId("city-picker-trigger").click();
  await expect(page.getByTestId("city-picker-option")).toHaveCount(9);
  await expect(page.getByTestId("city-picker-all-option")).toHaveAttribute("href", "/explorer/environment/air-quality");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("city-entity-navigation").getByRole("link")).toHaveText(["← მესტია", "ქუთაისი →"]);
});

test("Zestaponi's manual station lists four measures and selects dust", async ({ page }) => {
  await page.goto("/explorer/environment/air-quality/zestaponi");
  await ready(page);
  await expect(page.getByTestId("environment-latest")).toHaveText("ჩიკაშუას ქუჩა, მტვერი (TSP) · 2025: 400 მკგ/მ³");
  await expect(page.locator('[data-testid="series-row"]')).toHaveCount(4);
  expect(await tickedIds(page)).toEqual(["environment.aq.tsp_avg.zestaponi_e1"]);
  await expect(page.getByTestId("year-range-strip")).toContainText("2005–2025");
});

test("temperature and rain: Georgia's temperature, and a year the place has no figure is a dash", async ({ page }) => {
  await page.goto("/explorer/environment/climate");
  await ready(page);
  await expect(page.getByTestId("environment-latest")).toHaveText("საქართველო · 2024: 10.3°C · ნორმაზე +1.9°C");
  await expect(page.getByTestId("series-heading")).toHaveText(["საშუალო წლიური ტემპერატურა · °C", "გადახრა 1961–1990 წლების საშუალოდან · °C", "წლიური ნალექი · მმ"]);
  expect(await tickedIds(page)).toEqual(["environment.climate.temperature.georgia"]);
  await expect(page.getByTestId("year-range-strip")).toContainText("1990–2024");
  await page.getByTestId("chart-mode-table").click();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  await expect(await cell(page, "საქართველო", 1992)).toHaveText("—");
  await expect(await cell(page, "საქართველო", 2024)).toHaveText("10.3");
});

test("water selects the water taken in, and the loss share is its own heading", async ({ page }) => {
  await page.goto("/explorer/environment/water");
  await ready(page);
  await expect(page.getByTestId("environment-latest")).toHaveText("წყლის დანაკარგი · 2025: 64.4%");
  await expect(page.getByTestId("series-heading")).toHaveCount(5);
  expect(await tickedIds(page)).toEqual(["environment.water.gross"]);
  await expect(page.getByTestId("year-range-strip")).toContainText("2015–2025");
});

test("waste is the map and list with Georgia first, and a region opens its own page", async ({ page }) => {
  await page.goto("/explorer/environment/waste");
  await ready(page);
  await expect(page.getByTestId("environment-latest")).toHaveText("ნარჩენები · 2024: 1.18 მლნ ტონა");
  await expect(page.getByTestId("environment-region-map").getByTestId("regional-map-path")).toHaveCount(11);
  const rows = page.getByTestId("regional-list-row");
  await expect(rows).toHaveCount(12);
  await expect(rows.first()).toHaveAttribute("data-region-id", "georgia");
  await expect(rows.first()).toHaveAttribute("href", "/explorer/environment/waste/georgia");
  await expect(rows.first()).toContainText("1,184.0");
  await expect(rows.nth(1)).toHaveAttribute("data-region-id", "region.tbilisi");
  for (const id of ["chart-panel", "series-status", "environment-excel-download"]) await expect(page.getByTestId(id)).toHaveCount(0);
  await rows.filter({ hasText: "გურია" }).click();
  await expect(page).toHaveURL(/\/explorer\/environment\/waste\/guria$/);
  await ready(page);
  await expect(page.getByTestId("environment-latest")).toHaveText("ნარჩენები · 2024: 33 ათასი ტონა");
  expect(await tickedIds(page)).toEqual(["environment.waste.collected.region_guria"]);
  await page.getByTestId("region-picker-trigger").click();
  await expect(page.getByTestId("region-picker-option")).toHaveCount(12);
  await expect(page.getByTestId("region-picker-option").first()).toHaveText("საქართველო");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("environment-region-navigation").getByRole("link").last()).toHaveAttribute("href", "/explorer/environment/waste/imereti");
});

test("the Georgia waste page lists waste and waste per person", async ({ page }) => {
  await page.goto("/explorer/environment/waste/georgia");
  await ready(page);
  await expect(page.getByTestId("environment-latest")).toHaveText("ნარჩენები · 2024: 1,184 ათასი ტონა");
  await expect(page.getByTestId("series-heading")).toHaveText(["განთავსებული ნარჩენები · ათასი ტონა", "ერთ სულ მოსახლეზე · კგ"]);
  expect(await tickedIds(page)).toEqual(["environment.waste.collected.georgia"]);
});

test("forests list Tbilisi last without a value, and Tbilisi's page lists illegal logging only", async ({ page }) => {
  await page.goto("/explorer/environment/forests");
  await ready(page);
  await expect(page.getByTestId("environment-latest")).toHaveText("დამზადებული მერქანი · 2024: 376,215 მ³");
  const rows = page.getByTestId("regional-list-row");
  await expect(rows).toHaveCount(12);
  await expect(rows.first()).toHaveAttribute("data-region-id", "georgia");
  await expect(rows.last()).toHaveAttribute("data-region-id", "region.tbilisi");
  await expect(rows.last()).toContainText("—");
  await rows.last().click();
  await expect(page).toHaveURL(/\/explorer\/environment\/forests\/tbilisi$/);
  await ready(page);
  await expect(page.getByTestId("environment-latest")).toHaveText("ტყის უკანონო ჭრა · 2024: 4 მ³");
  expect(await tickedIds(page)).toEqual(["environment.forest.illegal_logging.region_tbilisi"]);
  await expect(page.locator('[data-testid="series-row"]')).toHaveCount(1);
});

test("the Georgia forests page lists timber, protected areas and fires under four headings", async ({ page }) => {
  await page.goto("/explorer/environment/forests/georgia");
  await ready(page);
  await expect(page.getByTestId("series-heading")).toHaveText(["ხე-ტყე · მ³", "დაცულ ტერიტორიებზე · მ³", "ტყისა და ველის ხანძრები · რაოდენობა", "ხანძრით მოცული ტყის ფართობი · ჰა"]);
  expect(await tickedIds(page)).toEqual(["environment.forest.timber_cut.georgia"]);
  await expect(page.getByTestId("year-range-strip")).toContainText("2010–2024");
});

test("the language switch keeps the selection, years and table mode", async ({ page }) => {
  await page.goto("/explorer/environment/greenhouse-gases#view=table&start=2010&end=2022&sel=environment.ghg.sector_energy,environment.ghg.sector_waste");
  await ready(page);
  await expect(ticked(page)).toHaveCount(2);
  const hash = new URL(page.url()).hash;
  await page.getByTestId("language-switch").first().getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/environment\/greenhouse-gases#/);
  expect(new URL(page.url()).hash).toBe(hash);
  await ready(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Greenhouse gases");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  await expect(ticked(page)).toHaveCount(2);
});

test("Excel downloads the city page's selection with links to the archived Geostat workbooks", async ({ page }) => {
  await page.goto("/explorer/environment/air-quality/tbilisi");
  await ready(page);
  const promise = page.waitForEvent("download");
  await page.getByTestId("environment-excel-download").click();
  const download = await promise;
  expect(download.suggestedFilename()).toMatch(/^fiscal-environment-air-quality-tbilisi-2017-2025\.xlsx$/);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await download.path())!);
  expect(workbook.worksheets).toHaveLength(3);
  const links: string[] = [];
  workbook.worksheets[2].eachRow(row => row.eachCell(cell => { const value = cell.value as { hyperlink?: string } | null; if (value && typeof value === "object" && value.hyperlink) links.push(value.hyperlink); }));
  expect(links.length).toBeGreaterThan(0);
  for (const link of links) expect(link).toContain("/downloads/methodology/environment/files/");
});

for (const prefix of ["", "/en"]) test(`the methodology link opens the environment methodology with its original files ${prefix || "ka"}`, async ({ page }) => {
  await page.goto(`${prefix}/explorer/environment/water`);
  await ready(page);
  await page.getByTestId("source-label").getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`${prefix}/methodology/environment$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(prefix ? "Environment and climate" : "გარემო და კლიმატი");
  const archived = page.locator('a[href^="/downloads/methodology/environment/files/"]');
  expect(await archived.count()).toBeGreaterThan(0);
  const response = await page.request.get(await archived.first().getAttribute("href") as string);
  expect(response.status()).toBe(200);
});

for (const prefix of ["", "/en"]) test(`environment pages fit a 375px screen with a one-line latest line ${prefix || "ka"}`, async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 375, height: 900 });
  const paths = ["", ...SECTIONS.map(section => `/${section}`), "/air-quality/tbilisi", "/air-quality/zestaponi", "/waste/georgia", "/forests/tbilisi"];
  for (const path of paths) {
    await page.goto(`${prefix}/explorer/environment${path}`);
    if (!path) continue;
    await ready(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
    const lines = await page.getByTestId("environment-latest").evaluate(line => line.getBoundingClientRect().height / parseFloat(getComputedStyle(line).lineHeight));
    expect(lines, `${prefix}${path}`).toBeLessThan(1.5);
  }
  expect(errors).toEqual([]);
});
