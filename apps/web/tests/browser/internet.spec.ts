import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";

const pressed = (id: string) => `[data-series-id="${id}"] [data-testid="series-row-toggle"]`;
const ticked = (page: Page) => page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]');
const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
const row = (page: Page, id: string) => page.locator(`[data-testid="regional-list-row"][data-region-id="${id}"]`);
const TOPICS = ["users", "online", "devices"];

/** The table cell of the row labelled `label` in the `year` column (the wide, year-columns layout). */
async function cell(page: Page, label: string, year: number) {
  const table = page.getByTestId("explorer-table");
  const column = (await table.locator("thead th").allInnerTexts()).findIndex(text => text.trim().startsWith(String(year)));
  expect(column).toBeGreaterThan(0);
  // The row label is the row's <th>, so value cells start one column earlier.
  return table.locator("tbody tr", { hasText: label }).locator("td").nth(column - 1);
}

test("the hub shows four cards, each opening its page", async ({ page }) => {
  await page.goto("/explorer/internet");
  const hub = page.getByTestId("internet-hub");
  await expect(hub.getByTestId("hub-card")).toHaveCount(4);
  expect(await hub.locator("a").evaluateAll(links => links.map(link => link.getAttribute("href")))).toEqual(["homes", ...TOPICS].map(section => `/explorer/internet/${section}`));
  await expect(page.getByTestId("internet-link")).toHaveAttribute("aria-current", "page");
});

test("users selects everyone who used the internet, lists three headings, and a row under another heading replaces it", async ({ page }) => {
  await page.goto("/explorer/internet/users");
  await ready(page);
  await expect(page.getByTestId("internet-latest")).toContainText("89.6");
  await expect(ticked(page)).toHaveCount(1);
  await expect(page.locator(pressed("internet.used_3m.total"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("series-heading")).toHaveCount(3);
  await expect(page.getByTestId("year-range-strip")).toContainText("2016–2026");
  await expect(page.getByTestId("source-label")).toContainText("საქსტატი");
  // Each heading counts a different population, so the chart shows one heading at a time.
  await page.locator(pressed("internet.never_used.total")).click();
  await expect(ticked(page)).toHaveCount(1);
  await expect(page.locator(pressed("internet.never_used.total"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(pressed("internet.used_3m.total"))).toHaveAttribute("aria-pressed", "false");
});

test("the table shows Geostat's figure for people aged 60 and older in 2016", async ({ page }) => {
  await page.goto("/explorer/internet/users");
  await ready(page);
  await page.locator(pressed("internet.used_3m.age_60_plus")).click();
  await expect(ticked(page)).toHaveCount(2);
  await page.getByTestId("chart-mode-table").click();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  await expect(await cell(page, "60 წლის და უფროსი", 2016)).toHaveText("14.6");
});

test("devices: ticking a smartphone row starts the years at 2019", async ({ page }) => {
  await page.goto("/explorer/internet/devices");
  await ready(page);
  await expect(page.getByTestId("internet-latest")).toContainText("93.3");
  await expect(page.getByTestId("year-range-strip")).toContainText("2016–2026");
  await page.locator(pressed("internet.own_smartphone.total")).click();
  await expect(ticked(page)).toHaveCount(1);
  await expect(page.getByTestId("year-range-strip")).toContainText("2019–2026");
});

test("homes is the map and list with Georgia first, and a region opens its own page", async ({ page }) => {
  await page.goto("/explorer/internet/homes");
  await ready(page);
  await expect(page.getByTestId("internet-latest")).toContainText("93.5");
  await expect(page.getByTestId("internet-region-map").getByTestId("regional-map-path")).toHaveCount(11);
  const rows = page.getByTestId("regional-list-row");
  await expect(rows).toHaveCount(12);
  await expect(rows.first()).toHaveAttribute("data-region-id", "georgia");
  await expect(rows.first()).toContainText("საქართველო");
  await expect(rows.first()).toHaveAttribute("href", "/explorer/internet/homes/georgia");
  await expect(rows.nth(1)).toHaveAttribute("data-region-id", "region.tbilisi");
  for (const id of ["chart-panel", "series-status", "internet-excel-download", "source-label"]) await expect(page.getByTestId(id)).toHaveCount(0);
  await row(page, "region.guria").click();
  await expect(page).toHaveURL(/\/explorer\/internet\/homes\/guria$/);
  await ready(page);
  await expect(page.locator(pressed("internet.homes_internet.region_guria"))).toHaveAttribute("aria-pressed", "true");
});

test("Guria starts in 2020 even when earlier years are asked for, and its Excel follows", async ({ page }) => {
  await page.goto("/explorer/internet/homes/guria#view=table&start=2016&end=2026");
  await ready(page);
  await expect(page.getByTestId("internet-latest")).toContainText("91.1");
  await expect(page.getByTestId("year-range-strip")).toContainText("2020–2026");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  const years = await page.getByTestId("explorer-table").locator("thead th").allInnerTexts();
  expect(years.some(text => text.trim().startsWith("2019"))).toBe(false);
  expect(years.some(text => text.trim().startsWith("2020"))).toBe(true);
  const promise = page.waitForEvent("download");
  await page.getByTestId("internet-excel-download").click();
  const download = await promise;
  expect(download.suggestedFilename()).toBe("fiscal-internet-homes-guria-2020-2026.xlsx");
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await download.path())!);
  expect(workbook.worksheets).toHaveLength(3);
});

test("Georgia: ticking towns, the next region opens with its internet row ticked", async ({ page }) => {
  await page.goto("/explorer/internet/homes/georgia");
  await ready(page);
  await expect(page.locator(pressed("internet.homes_internet.total"))).toHaveAttribute("aria-pressed", "true");
  await page.locator(pressed("internet.homes_internet.urban")).click();
  await expect(ticked(page)).toHaveCount(2);
  const next = page.getByTestId("internet-region-navigation").getByRole("link").last();
  await next.click();
  await expect(page).toHaveURL(/\/explorer\/internet\/homes\/tbilisi/);
  await ready(page);
  await expect(ticked(page)).toHaveCount(1);
  await expect(page.locator(pressed("internet.homes_internet.region_tbilisi"))).toHaveAttribute("aria-pressed", "true");
});

test("the language switch keeps the selection on users and on Guria", async ({ page }) => {
  await page.goto("/explorer/internet/users#view=table&start=2018&end=2026&sel=internet.daily.total,internet.daily.age_60_plus");
  await ready(page);
  await expect(ticked(page)).toHaveCount(2);
  const hash = new URL(page.url()).hash;
  await page.getByTestId("language-switch").first().getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/internet\/users#/);
  expect(new URL(page.url()).hash).toBe(hash);
  await ready(page);
  await expect(ticked(page)).toHaveCount(2);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");

  await page.goto("/explorer/internet/homes/guria");
  await ready(page);
  await page.locator(pressed("internet.homes_computer.region_guria")).click();
  await expect(ticked(page)).toHaveCount(2);
  const guriaHash = new URL(page.url()).hash;
  expect(guriaHash).toContain("internet.homes_computer.region_guria");
  await page.getByTestId("language-switch").first().getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/internet\/homes\/guria#/);
  expect(new URL(page.url()).hash).toBe(guriaHash);
  await ready(page);
  await expect(page.getByTestId("region-picker-trigger")).toHaveText("Guria");
  await expect(ticked(page)).toHaveCount(2);
});

test("the topic Excel download is a workbook linking the archived Geostat tables", async ({ page }) => {
  await page.goto("/explorer/internet/online");
  await ready(page);
  await expect(page.getByTestId("internet-latest")).toContainText("38.6");
  const promise = page.waitForEvent("download");
  await page.getByTestId("internet-excel-download").click();
  const download = await promise;
  expect(download.suggestedFilename()).toBe("fiscal-internet-online-2016-2026.xlsx");
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await download.path())!);
  expect(workbook.worksheets).toHaveLength(3);
  const links: string[] = [];
  workbook.worksheets[2].eachRow(row => row.eachCell(cell => { const value = cell.value as { hyperlink?: string } | null; if (value && typeof value === "object" && value.hyperlink) links.push(value.hyperlink); }));
  expect(links.length).toBeGreaterThan(0);
  for (const link of links) expect(link).toContain("/downloads/methodology/internet/files/");
});

for (const prefix of ["", "/en"]) test(`the methodology link opens the internet methodology with its original files ${prefix || "ka"}`, async ({ page }) => {
  await page.goto(`${prefix}/explorer/internet/users`);
  await ready(page);
  await page.getByTestId("source-label").getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`${prefix}/methodology/internet$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(prefix ? "Internet and technology" : "ინტერნეტი და ტექნოლოგიები");
  const archived = page.locator('a[href^="/downloads/methodology/internet/files/"]');
  expect(await archived.count()).toBe(36);
  const response = await page.request.get(await archived.first().getAttribute("href") as string);
  expect(response.status()).toBe(200);
});

for (const prefix of ["", "/en"]) test(`internet pages fit a 390px screen and keep the latest line on one line at 375px ${prefix || "ka"}`, async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const paths = ["/explorer/internet", ...TOPICS.map(section => `/explorer/internet/${section}`), "/explorer/internet/homes", "/explorer/internet/homes/guria"];
  await page.setViewportSize({ width: 390, height: 900 });
  for (const path of paths) {
    await page.goto(`${prefix}${path}`);
    if (path !== "/explorer/internet") await ready(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of paths.slice(1)) {
    await page.goto(`${prefix}${path}`);
    await ready(page);
    await page.evaluate(() => document.fonts.ready);
    const lines = await page.getByTestId("internet-latest").evaluate(element => element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight));
    expect(lines, path).toBeLessThanOrEqual(1.6);
  }
  expect(errors).toEqual([]);
});
