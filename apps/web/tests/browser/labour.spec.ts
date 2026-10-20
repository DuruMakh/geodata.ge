import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import { expectEnglish } from "./expect-english";
import { tableSeriesValues } from "./explorer-table";

// The four Labour Force Survey detail pages under Unemployment (spec 2026-10-20-labour-detail §§3–8).
// Page overflow at 390/768/1440 and the §17 line check are also in the layout pass of mobile-fit-charts.spec.ts;
// the hub cards' order and links are in unemployment.spec.ts.
const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
const toggle = (id: string) => `[data-series-id="${id}"] [data-testid="series-row-toggle"]`;
const pressed = (page: Page) => page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]');
/** The list's count, anchored so "2 / 60" never matches "12 / 60". */
const status = (selected: number, all: number) => new RegExp(`^\\D*${selected} / ${all}$`);

const PAGES = [
  { section: "industries", total: "labour.jobs.all.total", rows: 60, ka: "დასაქმებული · 2025: 1,389.7 ათასი", en: "Employed · 2025: 1,389.7 thousand" },
  { section: "hours", total: "labour.hours.all.total", rows: 85, ka: "ჩვეულებრივი საათები კვირაში · 2025: 41.0", en: "Usual weekly hours · 2025: 41.0" },
  { section: "informal", total: "labour.informal.total", rows: 5, ka: "არაფორმალური დასაქმების წილი · 2025: 28.3%", en: "Informal share of non-farm jobs · 2025: 28.3%" },
  { section: "young-people", total: "labour.neet.age_15_24.total", rows: 6, ka: "15–24 წლის ახალგაზრდები · 2025: 17.6%", en: "Aged 15–24, not in work or study · 2025: 17.6%" },
] as const;

/** How many line boxes an element's text takes: its height over its line height. */
const lines = (page: Page, testId: string) => page.getByTestId(testId).evaluate((element) => {
  const style = getComputedStyle(element);
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
  return element.getBoundingClientRect().height / lineHeight;
});

for (const locale of ["ka", "en"] as const) for (const width of [375, 768, 1440]) {
  test(`each page opens with only its total ticked and a one-line latest figure ${locale} at ${width}px`, async ({ page }) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    for (const { section, total, rows, ...latest } of PAGES) {
      await page.goto(`${locale === "en" ? "/en" : ""}/explorer/unemployment/${section}`);
      await ready(page);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.getByTestId(`labour-${section}`)).toBeVisible();
      await expect(page.getByTestId("labour-latest")).toHaveText(latest[locale]);
      expect(await lines(page, "labour-latest"), `${section} latest line`).toBeLessThanOrEqual(1.5);
      await expect(page.getByTestId("series-row")).toHaveCount(rows);
      await expect(pressed(page)).toHaveCount(1);
      await expect(page.locator(toggle(total))).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByTestId("series-status")).toHaveText(status(1, rows));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${section} fits ${width}px`).toBe(true);
      if (locale === "en" && width === 1440) await expectEnglish(page);
    }
    expect(errors).toEqual([]);
  });
}

test("the hub cards 05–08 show each page total's latest figure and coverage, and the sidebar lists the eight pages", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [prefix, footers] of [
    ["", ["2025 · 1,389.7 ათასი · 2017–2025", "2025 · 41.0 საათი · 2020–2025", "2025 · 28.3% · 2020–2025", "2025 · 17.6% · 2020–2025"]],
    ["/en", ["2025 · 1,389.7 thousand · 2017–2025", "2025 · 41.0 hours · 2020–2025", "2025 · 28.3% · 2020–2025", "2025 · 17.6% · 2020–2025"]],
  ] as const) {
    await page.goto(`${prefix}/explorer/unemployment`);
    const cards = page.getByTestId("unemployment-hub").getByTestId("hub-card");
    await expect(cards).toHaveCount(8);
    for (const [offset, footer] of footers.entries()) {
      await expect(cards.nth(4 + offset)).toContainText(footer);
      await expect(cards.nth(4 + offset).locator("svg")).toHaveCount(1);
    }
    const sidebar = ["overview", "regions", "age", "gender", "industries", "hours", "informal", "young-people"];
    const links = sidebar.map(section => page.getByTestId(`unemployment-${section}-link`).first());
    for (const link of links) await expect(link).toBeVisible();
    const hrefs = await Promise.all(links.map(link => link.getAttribute("href")));
    expect(hrefs).toEqual(sidebar.map(section => `${prefix}/explorer/unemployment/${section}`));
    const tops = await Promise.all(links.map(async link => (await link.boundingBox())!.y));
    expect([...tops].sort((a, b) => a - b)).toEqual(tops);
  }
});

test("Jobs: three headings, Women — Construction starts in 2020, search keeps the count, Excel downloads", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/explorer/unemployment/industries");
  await ready(page);
  await expect(page.getByTestId("series-heading")).toHaveText(["ყველა", "ქალები", "კაცები"]);
  await expect(page.getByTestId("labour-unit-label")).toHaveText("ათასი ადამიანი");
  await expect(page.getByTestId("year-range-strip")).toContainText("2017–2025");
  // Ticking Women — Construction adds its 2020–2025 line to the total's 2017–2025; alone it moves the years to 2020.
  await page.locator(toggle("labour.jobs.women.sector_f")).click();
  await expect(pressed(page)).toHaveCount(2);
  await expect(page.getByTestId("year-range-strip")).toContainText("2017–2025");
  await page.locator(toggle("labour.jobs.all.total")).click();
  await expect(pressed(page)).toHaveCount(1);
  await expect(page.getByTestId("year-range-strip")).toContainText("2020–2025");
  await expect(page).toHaveURL(/#view=line&sel=labour\.jobs\.women\.sector_f&range=all$/);
  // Outside the list the row carries its heading; before 2020 it is a dash, never a zero.
  await page.locator(toggle("labour.jobs.all.total")).click();
  await page.getByTestId("chart-mode-table").click();
  const table = page.getByTestId("explorer-table");
  await expect(table).toContainText("ქალები — მშენებლობა");
  const women = await tableSeriesValues(table, "ქალები — მშენებლობა");
  expect(women.slice(0, 3)).toEqual(["—", "—", "—"]);
  expect(women.slice(3).every(value => /^\d+\.\d$/.test(value))).toBe(true);
  // Search narrows the list to Construction under each heading (the total stays pinned) but never the count or "select all".
  await page.getByTestId("series-search").fill("მშენებლობა");
  await expect(page.getByTestId("series-row")).toHaveCount(4);
  await expect(page.getByTestId("series-label").filter({ hasText: /^მშენებლობა$/ })).toHaveCount(3);
  await expect(page.getByTestId("series-status")).toHaveText(status(2, 60));
  await page.getByTestId("series-toggle-all").click();
  await expect(page.getByTestId("series-status")).toHaveText(status(0, 60));
  await page.getByTestId("series-toggle-all").click();
  await expect(page.getByTestId("series-status")).toHaveText(status(60, 60));
  await expect(pressed(page)).toHaveCount(4);
  await page.getByTestId("series-search").fill("");
  await expect(pressed(page)).toHaveCount(60);
  // Excel: the selection, in one workbook.
  await page.locator(toggle("labour.jobs.all.total")).click();
  const promise = page.waitForEvent("download");
  await page.getByTestId("labour-excel-download").click();
  const file = await promise;
  expect(file.suggestedFilename()).toBe("fiscal-labour-industries-2017-2025.xlsx");
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await file.path())!);
  expect(workbook.worksheets.map(sheet => sheet.name)).toEqual(["მარტივი ცხრილი", "მონაცემები", "წყაროები"]);
  // The Data sheet names a selected row with its heading.
  const data = workbook.getWorksheet("მონაცემები")!.getColumn(2).values;
  expect(data).toContain("ქალები — მშენებლობა");
});

test("Hours: men in households as employers is all dashes in the table, and the language switch keeps the hash", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const hash = "#view=table&sel=labour.hours.all.total%2Clabour.hours.men.sector_t&range=all";
  await page.goto(`/explorer/unemployment/hours${hash}`);
  await ready(page);
  await expect(page.getByTestId("series-heading")).toHaveText(["ყველა", "ქალები", "კაცები", "ქალაქი", "სოფელი"]);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  await expect(pressed(page)).toHaveCount(2);
  await expect(page.getByTestId("year-range-strip")).toContainText("2020–2025");
  const table = page.getByTestId("explorer-table");
  expect(await tableSeriesValues(table, "კაცები — შინამეურნეობების")).toEqual(Array(6).fill("—"));
  expect((await tableSeriesValues(table, "სულ")).every(value => /^\d+\.\d$/.test(value))).toBe(true);
  // The list shows a dash for the row with no values.
  await expect(page.locator('[data-testid="series-row"][data-series-id="labour.hours.men.sector_t"]')).toContainText("—");
  await page.getByTestId("language-switch").first().getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/en/explorer/unemployment/hours${hash.replace(/\./g, "\\.")}$`));
  await ready(page);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  await expect(pressed(page)).toHaveCount(2);
  await expect(page.locator(toggle("labour.hours.men.sector_t"))).toHaveAttribute("aria-pressed", "true");
  expect(await tableSeriesValues(page.getByTestId("explorer-table"), "Men — Activities of households")).toEqual(Array(6).fill("—"));
  await expect(page.getByTestId("labour-unit-label")).toHaveText("hours per week");
  // Alone, the row Geostat does not publish has nothing to draw: a short message, not an empty chart.
  await page.locator(toggle("labour.hours.all.total")).click();
  await expect(page.getByTestId("no-values-callout")).toHaveText("No published values for this selection.");
});

for (const prefix of ["", "/en"]) test(`the source line's methodology link opens the unemployment methodology ${prefix || "ka"}`, async ({ page }) => {
  await page.goto(`${prefix}/explorer/unemployment/young-people`);
  await ready(page);
  await expect(page.getByTestId("source-label")).toContainText(prefix ? "Source: Geostat, Labour Force Survey · % · 2020–2025" : "წყარო: საქსტატი, შრომის ძალის გამოკვლევა · % · 2020–2025");
  await page.getByTestId("source-label").getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`${prefix}/methodology/unemployment$`));
});
