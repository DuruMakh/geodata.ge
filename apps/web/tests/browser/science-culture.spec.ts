import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";

const pressed = (id: string) => `[data-series-id="${id}"] [data-testid="series-row-toggle"]`;
const ticked = (page: Page) => page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]');
const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
const row = (page: Page, id: string) => page.locator(`[data-testid="regional-list-row"][data-region-id="${id}"]`);
const sc = (measure: string, group: string) => `science_culture.${measure}.${group}`;
const SECTIONS = ["research", "patents", "museums", "theatres"];
const english = (page: Page) => page.getByTestId("language-switch").first().getByRole("link", { name: "English", exact: true });

/** The table cell of the row labelled `label` in the `year` column (the wide, year-columns layout). */
async function cell(page: Page, label: string, year: number) {
  const table = page.getByTestId("explorer-table");
  const column = (await table.locator("thead th").allInnerTexts()).findIndex(text => text.trim().startsWith(String(year)));
  expect(column).toBeGreaterThan(0);
  // The row label is the row's <th>, so value cells start one column earlier.
  return table.locator("tbody tr", { hasText: label }).locator("td").nth(column - 1);
}

test.use({ viewport: { width: 1440, height: 900 } });

test("the hub shows four cards, each opening its page, and the sidebar lists Science and culture after Education", async ({ page }) => {
  for (const prefix of ["", "/en"]) {
    await page.goto(`${prefix}/explorer/science-culture`);
    const hub = page.getByTestId("science-culture-hub");
    await expect(hub.getByTestId("hub-card")).toHaveCount(4);
    expect(await hub.locator("a").evaluateAll(links => links.map(link => link.getAttribute("href")))).toEqual(SECTIONS.map(section => `${prefix}/explorer/science-culture/${section}`));
    for (let index = 0; index < 4; index += 1) await expect(hub.locator("a").nth(index).locator("svg")).toHaveCount(1);
    const entry = page.getByTestId("science-culture-link");
    await expect(entry).toHaveAttribute("aria-current", "page");
    expect(await page.getByTestId("education-link").evaluate((education, science) => Boolean(education.compareDocumentPosition(science!) & Node.DOCUMENT_POSITION_FOLLOWING), await entry.elementHandle())).toBe(true);
    for (const id of SECTIONS) await expect(page.getByTestId(`science-culture-${id}-link`)).toBeVisible();
  }
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Science and culture");
  const cards = page.getByTestId("science-culture-hub").locator("a");
  for (const [index, footer] of ["2024 · 14,046 · 2019–2024", "2025 · 79 · 2016–2025", "2025 · 1,998.9 · 2005–2025", "2025 · 620.3 · 2006–2025"].entries()) await expect(cards.nth(index)).toContainText(footer);
});

test("research selects all researchers, and ticking spending replaces them (one unit at a time)", async ({ page }) => {
  await page.goto("/explorer/science-culture/research");
  await ready(page);
  await expect(page.getByTestId("science-culture-latest")).toHaveText("2024: 14,046 მკვლევარი");
  await expect(ticked(page)).toHaveCount(1);
  await expect(page.locator(pressed(sc("researchers", "total")))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("series-heading")).toHaveCount(7);
  await expect(page.getByTestId("series-status")).toContainText("1 / 26");
  // No tab row or measure switch, and one source line.
  await expect(page.locator('[data-testid^="science-culture-measure-"]')).toHaveCount(0);
  await expect(page.getByTestId("year-range-strip")).toContainText("2019–2024");
  await expect(page.getByTestId("source-label")).toContainText("საქსტატი");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "persons");
  // Women are persons too: they join the chart.
  await page.locator(pressed(sc("researchers", "women"))).click();
  await expect(ticked(page)).toHaveCount(2);
  await page.locator(pressed(sc("rd_spending", "total"))).click();
  await expect(ticked(page)).toHaveCount(1);
  await expect(page.locator(pressed(sc("rd_spending", "total")))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "gel");
  await expect(page.getByTestId("science-culture-unit-label")).toHaveText("მლნ ლარი");
  await expect(page.getByTestId("science-culture-latest")).toContainText("14,046");
});

test("patents: rows of all four headings chart together", async ({ page }) => {
  await page.goto("/en/explorer/science-culture/patents");
  await ready(page);
  await expect(page.getByTestId("science-culture-latest")).toHaveText("2025: 79 invention applications from Georgia");
  await expect(page.getByTestId("series-heading")).toHaveText(["Invention applications", "Invention patents granted", "Utility model applications", "Utility model patents granted"]);
  await expect(page.getByTestId("series-status")).toContainText("1 / 12");
  const granted = page.getByRole("group", { name: "Invention patents granted" });
  await expect(granted.getByTestId("series-label")).toHaveText(["Georgian", "Foreign", "International route"]);
  await granted.locator(pressed(sc("invention_patents", "foreign"))).click();
  await expect(ticked(page)).toHaveCount(2);
  await expect(page.locator(pressed(sc("invention_patents", "foreign")))).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(pressed(sc("invention_applications", "local")))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("year-range-strip")).toContainText("2016–2025");
});

test("theatres: the audience marks the 2021 counting change; seats alone and events do not, and events before 2021 are dashes (Review Focus 1, 4)", async ({ page }) => {
  await page.goto("/en/explorer/science-culture/theatres");
  await ready(page);
  await expect(page.getByTestId("science-culture-latest")).toHaveText("2025: 620.3 thousand theatre-goers");
  await expect(page.locator(pressed(sc("theatre_audience", "total")))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("series-heading")).toHaveText(["Audience · thousand", "Shows", "Events", "Theatres", "Seats · thousand", "Staff"]);
  const breaks = page.getByTestId("chart-panel").getByTestId("chart-break");
  await expect(breaks).toHaveCount(1);
  await expect(breaks.first()).toContainText("new counting");
  await page.getByTestId("chart-mode-table").click();
  await expect(page.getByTestId("explorer-table").locator("thead th", { hasText: "2021" })).toContainText("new counting");
  await page.getByTestId("chart-mode-line").click();
  // Seats share the audience's unit; alone they draw no rule.
  await page.locator(pressed(sc("theatre_seats", "total"))).click();
  await expect(ticked(page)).toHaveCount(2);
  await page.locator(pressed(sc("theatre_audience", "total"))).click();
  await expect(ticked(page)).toHaveCount(1);
  await expect(breaks).toHaveCount(0);
  // Events are counted from 2021: earlier years are gaps, a dash in the table, never zero.
  await page.locator(pressed(sc("theatre_events", "total"))).click();
  await expect(ticked(page)).toHaveCount(1);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "count");
  await page.getByTestId("chart-mode-table").click();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  await expect(await cell(page, "Events in Georgia", 2010)).toHaveText("—");
  await expect(await cell(page, "Events in Georgia", 2021)).toHaveText(/^\d[\d,]*$/);
  await expect(page.getByTestId("explorer-table").locator("thead th", { hasText: "new counting" })).toHaveCount(0);
});

test("museums is the map and list with Georgia first, and a region opens its own page", async ({ page }) => {
  await page.goto("/explorer/science-culture/museums");
  await ready(page);
  await expect(page.getByTestId("science-culture-latest")).toHaveText("2025: 2.0 მლნ დამთვალიერებელი მუზეუმებში");
  await expect(page.getByTestId("science-culture-region-map").getByTestId("regional-map-path")).toHaveCount(11);
  const rows = page.getByTestId("regional-list-row");
  await expect(rows).toHaveCount(12);
  await expect(rows.first()).toHaveAttribute("data-region-id", "georgia");
  await expect(rows.first()).toContainText("საქართველო");
  await expect(rows.first()).toContainText("1,998.9");
  await expect(rows.first()).toHaveAttribute("href", "/explorer/science-culture/museums/georgia");
  await expect(rows.nth(1)).toHaveAttribute("data-region-id", "region.tbilisi");
  // No map switch and no chart workspace: the one source line is the index footer.
  for (const id of ["chart-panel", "series-status", "science-culture-excel-download", "source-label"]) await expect(page.getByTestId(id)).toHaveCount(0);
  await expect(page.getByTestId("regional-source-note")).toContainText("geoBoundaries");
  await row(page, "region.guria").click();
  await expect(page).toHaveURL(/\/explorer\/science-culture\/museums\/guria$/);
  await ready(page);
  await expect(ticked(page)).toHaveCount(1);
  await expect(page.locator(pressed(sc("museum_visitors", "region_guria")))).toHaveAttribute("aria-pressed", "true");
});

test("from Georgia a museum type does not travel: Next opens Tbilisi on its default (Review Focus 3)", async ({ page }) => {
  await page.goto("/explorer/science-culture/museums/georgia");
  await ready(page);
  await expect(page.getByTestId("series-heading")).toHaveText(["დამთვალიერებლები · ათასი", "ექსკურსიები · ათასი", "გამოფენები", "მუზეუმები", "პერსონალი"]);
  await expect(page.getByTestId("series-status")).toContainText("1 / 18");
  await page.locator(pressed(sc("museums", "type_art"))).click();
  await expect(ticked(page)).toHaveCount(1);
  await expect(page.locator(pressed(sc("museums", "type_art")))).toHaveAttribute("aria-pressed", "true");
  const next = page.getByTestId("science-culture-region-navigation").getByRole("link").last();
  await expect(next).toHaveAttribute("href", "/explorer/science-culture/museums/tbilisi");
  await next.click();
  await expect(page).toHaveURL(/\/explorer\/science-culture\/museums\/tbilisi$/);
  await ready(page);
  await expect(ticked(page)).toHaveCount(1);
  await expect(page.locator(pressed(sc("museum_visitors", "region_tbilisi")))).toHaveAttribute("aria-pressed", "true");
});

test("the Guria page: picker, neighbours carrying group tours, Excel and the language switch (Review Focus 3, 5)", async ({ page }) => {
  await page.goto("/explorer/science-culture/museums/guria");
  await ready(page);
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toContainText("მუზეუმები —");
  await expect(heading.getByTestId("region-picker-trigger")).toHaveText("გურია");
  await expect(page.getByTestId("science-culture-latest")).toHaveText(/^2025: \d[\d,]*\.\d ათასი დამთვალიერებელი$/);
  await expect(page.getByTestId("series-heading")).toHaveText(["დამთვალიერებლები · ათასი", "ექსკურსიები · ათასი", "გამოფენები", "მუზეუმები"]);
  await expect(page.getByTestId("series-row")).toHaveCount(4);
  await expect(page.getByTestId("year-range-strip")).toContainText("2005–2025");
  // The picker lists Georgia first and returns to the index.
  await page.getByTestId("region-picker-trigger").click();
  await expect(page.getByTestId("region-picker-option")).toHaveCount(12);
  await expect(page.getByTestId("region-picker-option").first()).toHaveText("საქართველო");
  await expect(page.getByTestId("region-picker-all-option")).toHaveAttribute("href", "/explorer/science-culture/museums");
  await page.keyboard.press("Escape");
  const navigation = page.getByTestId("science-culture-region-navigation");
  await expect(navigation.getByRole("link")).toHaveText(["← აჭარა", "იმერეთი →"]);
  // Group tours share the visitors' unit: they join, and the next region's link carries both, moved to that region.
  await page.locator(pressed(sc("museum_tours", "region_guria"))).click();
  await expect(ticked(page)).toHaveCount(2);
  await expect(page).toHaveURL(/#view=line&sel=science_culture\.museum_visitors\.region_guria%2Cscience_culture\.museum_tours\.region_guria/);
  await expect(navigation.getByRole("link").last()).toHaveAttribute("href", "/explorer/science-culture/museums/imereti#sel=science_culture.museum_visitors.region_imereti%2Cscience_culture.museum_tours.region_imereti");
  const promise = page.waitForEvent("download");
  await page.getByTestId("science-culture-excel-download").click();
  const download = await promise;
  expect(download.suggestedFilename()).toMatch(/^fiscal-science-culture-museums-guria-2005-2025\.xlsx$/);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await download.path())!);
  expect(workbook.worksheets).toHaveLength(3);
  // The language switch keeps the selection.
  await english(page).click();
  await expect(page).toHaveURL(/\/en\/explorer\/science-culture\/museums\/guria#view=line&sel=science_culture\.museum_visitors\.region_guria%2Cscience_culture\.museum_tours\.region_guria/);
  await ready(page);
  await expect(page.getByTestId("region-picker-trigger")).toHaveText("Guria");
  await expect(page.getByTestId("series-heading")).toHaveText(["Visitors · thousand", "Group tours · thousand", "Exhibitions", "Museums"]);
  await expect(ticked(page)).toHaveCount(2);
  await page.getByTestId("science-culture-region-navigation").getByRole("link", { name: "Imereti →" }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/science-culture\/museums\/imereti#sel=science_culture\.museum_visitors\.region_imereti%2Cscience_culture\.museum_tours\.region_imereti$/);
  await ready(page);
  await expect(ticked(page)).toHaveCount(2);
  await expect(page.locator(pressed(sc("museum_tours", "region_imereti")))).toHaveAttribute("aria-pressed", "true");
});

test("the language switch keeps the selection, years and table mode on research (Review Focus 5)", async ({ page }) => {
  await page.goto(`/explorer/science-culture/research#view=table&start=2020&end=2024&sel=${sc("researchers", "total")},${sc("researchers", "women")}`);
  await ready(page);
  await expect(ticked(page)).toHaveCount(2);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  const hash = new URL(page.url()).hash;
  expect(hash).toContain("view=table");
  await english(page).click();
  await expect(page).toHaveURL(/\/en\/explorer\/science-culture\/research#/);
  expect(new URL(page.url()).hash).toBe(hash);
  await ready(page);
  await expect(page.getByTestId("science-culture-latest")).toHaveText("2024: 14,046 researchers");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  await expect(ticked(page)).toHaveCount(2);
  await expect(page.getByTestId("year-range-strip")).toContainText("2020–2024");
  await expect(page.getByTestId("explorer-table")).toContainText("Researchers — Women");
});

test("the topic Excel download is a workbook", async ({ page }) => {
  await page.goto("/explorer/science-culture/research");
  await ready(page);
  const promise = page.waitForEvent("download");
  await page.getByTestId("science-culture-excel-download").click();
  const download = await promise;
  expect(download.suggestedFilename()).toMatch(/^fiscal-science-culture-research-2019-2024\.xlsx$/);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await download.path())!);
  expect(workbook.worksheets).toHaveLength(3);
});

for (const prefix of ["", "/en"]) test(`science and culture pages fit a 375px screen with a one-line latest line ${prefix || "ka"}`, async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of ["/explorer/science-culture", ...SECTIONS.map(section => `/explorer/science-culture/${section}`), "/explorer/science-culture/museums/guria"]) {
    await page.goto(`${prefix}${path}`);
    if (path !== "/explorer/science-culture") {
      await ready(page);
      const line = page.getByTestId("science-culture-latest");
      expect(await line.evaluate(element => element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight)), `${path}: ${await line.textContent()}`).toBeLessThanOrEqual(1.1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
  }
  expect(errors).toEqual([]);
});
