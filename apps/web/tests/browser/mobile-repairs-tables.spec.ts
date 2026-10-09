import { expect, test, type Locator } from "@playwright/test";

// Mobile repairs (2026-10-07 review): tables must show numbers on a 390px phone.
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

/** Year cells of the first body row whose centre is inside the scroller and not covered by a sticky cell. */
async function visibleYearCells(scroller: Locator): Promise<number> {
  return scroller.evaluate((element) => {
    const headers = [...element.querySelectorAll("thead th")];
    const yearColumns = headers.flatMap((th, index) => (/^\d{4}$/.test(th.textContent?.trim() ?? "") ? [index] : []));
    const row = element.querySelector("tbody tr");
    if (!row) return 0;
    const cells = [...row.querySelectorAll("td")];
    const frame = element.getBoundingClientRect();
    return yearColumns.filter((index) => {
      const cell = cells[index];
      if (!cell) return false;
      const box = cell.getBoundingClientRect();
      const x = (box.left + box.right) / 2;
      const y = (box.top + box.bottom) / 2;
      if (x <= frame.left || x >= frame.right) return false;
      const hit = document.elementFromPoint(x, y);
      return hit !== null && (hit === cell || cell.contains(hit));
    }).length;
  });
}

const longLabelSelection =
  "#g=fields&m=table&r=2004-2025&sel=expenditure.total%2Cspending.social_protection%2Cspending.infrastructure_regional_development%2Cspending.education";

const municipalFourSeries = "#m=table&sel=municipal.total,municipal.education,municipal.social_protection,municipal.economic_affairs";

// More than three series keep the year columns (owner decision D5, 2026-10-07).
const columnCases = [
  { name: "expenditure with a long-label series", path: `/explorer/expenditure${longLabelSelection}`, minYears: 3 },
  { name: "English expenditure with a long-label series", path: `/en/explorer/expenditure${longLabelSelection}`, minYears: 3 },
  { name: "Georgia municipal aggregate, four series", path: `/explorer/municipalities/georgia${municipalFourSeries}`, minYears: 2 },
  { name: "Batumi, four series", path: `/explorer/municipalities/batumi${municipalFourSeries}`, minYears: 3 },
  { name: "English Batumi, four series", path: `/en/explorer/municipalities/batumi${municipalFourSeries}`, minYears: 3 },
];

for (const { name, path, minYears } of columnCases) {
  test(`table mode shows year values at 390px: ${name}`, async ({ page }) => {
    await page.goto(path);
    const scroller = page.getByTestId("explorer-table");
    await scroller.scrollIntoViewIfNeeded();
    await expect(scroller).toHaveAttribute("data-layout", "columns");
    await expect(scroller.locator("tbody tr").first()).toBeVisible();
    // The table opens on the latest year, so the latest-year column is in view.
    await expect.poll(() => scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await expect.poll(() => visibleYearCells(scroller)).toBeGreaterThanOrEqual(minYears);
    // Names wrap at a readable size rather than widening the column.
    expect(await scroller.locator("tbody td").first().evaluate((cell) => parseFloat(getComputedStyle(cell.querySelector("span span:last-child") ?? cell).fontSize))).toBeGreaterThanOrEqual(12);
    expect(await scroller.locator("thead th").evaluateAll((cells) => cells.slice(1).filter((cell) => getComputedStyle(cell).position === "sticky").length)).toBe(0);
    const latestVisible = await scroller.evaluate((element) => {
      const latest = element.querySelector("thead th[data-latest-year]")!.getBoundingClientRect();
      const frame = element.getBoundingClientRect();
      return latest.right <= frame.right + 1 && latest.left >= frame.left;
    });
    expect(latestVisible).toBe(true);
    // The sticky label column leaves most of the scroller to the numbers.
    const labelWidth = await scroller.locator("thead th").first().evaluate((th) => th.getBoundingClientRect().width);
    const frameWidth = await scroller.evaluate((element) => element.clientWidth);
    expect(labelWidth).toBeLessThanOrEqual(frameWidth * 0.41);
  });
}

const threeSeries = "#g=fields&m=table&r=2004-2025&sel=expenditure.total%2Cspending.social_protection%2Cspending.infrastructure_regional_development";

// Up to three series list the years as rows, newest first, with no sideways scroll (D5).
const rowCases = [
  { name: "expenditure total", path: "/explorer/expenditure#m=table" },
  { name: "expenditure, three long-label series", path: `/explorer/expenditure${threeSeries}`, series: 3 },
  { name: "English expenditure, three long-label series", path: `/en/explorer/expenditure${threeSeries}`, series: 3 },
  { name: "revenue", path: "/explorer/revenue#m=table" },
  { name: "debt", path: "/explorer/debt#m=table" },
  { name: "deficit", path: "/explorer/deficit#m=table", mark: "პროგნოზი" },
  { name: "Georgia municipal aggregate", path: "/explorer/municipalities/georgia#m=table", summary: "ცვლილება" },
  { name: "Batumi", path: "/explorer/municipalities/batumi#m=table", summary: "ცვლილება" },
  { name: "English Batumi", path: "/en/explorer/municipalities/batumi#m=table", summary: "Change" },
  { name: "GDP", path: "/explorer/economy/gdp" },
  { name: "economic sectors", path: "/explorer/economy/sectors", mark: "წინასწარი" },
  { name: "Adjara economy", path: "/explorer/economy/regions/adjara" },
  { name: "unemployment", path: "/explorer/unemployment/overview" },
];

for (const width of [390, 360]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 844 } });
    for (const { name, path, series, mark, summary } of rowCases) {
      test(`small tables list years as rows, newest first: ${name}`, async ({ page }) => {
        await page.goto(path);
        const scroller = page.getByTestId("explorer-table");
        if (!path.includes("m=table")) await page.getByRole("button", { name: /^(ცხრილი|Table)$/ }).first().click();
        await expect(scroller).toHaveAttribute("data-layout", "rows");
        await scroller.scrollIntoViewIfNeeded();
        const shape = await scroller.evaluate((element) => ({
          scrolls: element.scrollWidth > element.clientWidth,
          seriesHeaders: element.querySelectorAll("thead th[data-series-id]").length,
          years: [...element.querySelectorAll("tbody tr[data-year]")].map((row) => Number((row as HTMLElement).dataset.year)),
          cellsPerYear: [...element.querySelectorAll("tbody tr[data-year]")].map((row) => row.querySelectorAll("td").length),
          overflowing: [...element.querySelectorAll("th, td")].filter((cell) => cell.scrollWidth > cell.clientWidth + 1).map((cell) => cell.textContent),
          valueFont: parseFloat(getComputedStyle(element.querySelector("tbody tr[data-year] td")!).fontSize),
        }));
        expect(shape.scrolls).toBe(false);
        expect(shape.overflowing).toEqual([]);
        expect(shape.seriesHeaders).toBe(series ?? 1);
        expect(new Set(shape.cellsPerYear)).toEqual(new Set([series ?? 1]));
        expect(shape.years.length).toBeGreaterThan(3);
        expect(shape.years).toEqual([...shape.years].sort((a, b) => b - a));
        expect(shape.valueFont).toBeGreaterThanOrEqual(12);
        // The newest year is the first row, inside the frame.
        await expect(scroller.locator("tbody tr[data-year]").first()).toBeInViewport();
        if (mark) await expect(scroller.locator("tbody tr[data-year]").getByText(mark, { exact: true }).first()).toBeVisible();
        if (summary) await expect(scroller.locator("tbody tr[data-summary='change'] th")).toHaveText(summary);
      });
    }
  });
}

test("the share measure keeps percentages in the year rows", async ({ page }) => {
  await page.goto("/explorer/expenditure#m=table&sh=1");
  const scroller = page.getByTestId("explorer-table");
  await expect(scroller).toHaveAttribute("data-layout", "rows");
  await expect(scroller.locator("tbody tr[data-year]").first().locator("td").first()).toHaveText(/%$/);
});

for (const path of ["/explorer/expenditure", "/explorer/revenue", "/en/explorer/expenditure"]) {
  test(`national period comparison keeps every cell inside its column at 390px: ${path}`, async ({ page }) => {
    await page.goto(path);
    const table = page.getByTestId("period-comparison").locator("table");
    await table.scrollIntoViewIfNeeded();
    const overflowing = await table.evaluate((element) =>
      [...element.querySelectorAll("th, td")].filter((cell) => cell.scrollWidth > cell.clientWidth + 1).map((cell) => cell.textContent));
    expect(overflowing).toEqual([]);
  });
}

for (const path of ["/explorer/municipalities/georgia", "/explorer/municipalities/batumi", "/explorer/municipalities/region/adjara", "/en/explorer/municipalities/batumi"]) {
  test(`period comparison fits a 390px phone without a sideways scroll: ${path}`, async ({ page }) => {
    await page.goto(path);
    const table = page.getByTestId("comparison-table");
    await table.scrollIntoViewIfNeeded();
    const fit = await table.evaluate((element) => {
      const scroller = element.parentElement!;
      const cells = [...element.querySelectorAll("th, td")];
      return {
        tableFits: scroller.scrollWidth <= scroller.clientWidth,
        overflowingCells: cells.filter((cell) => cell.scrollWidth > cell.clientWidth + 1).map((cell) => cell.textContent),
        headers: [...element.querySelectorAll("thead th")].map((th) => th.getBoundingClientRect().right),
      };
    });
    expect(fit.tableFits).toBe(true);
    expect(fit.overflowingCells).toEqual([]);
    expect(fit.headers).toHaveLength(4);
    for (const right of fit.headers) expect(right).toBeLessThanOrEqual(390);
  });
}

for (const locale of ["ka", "en"] as const) {
  test(`${locale} products table shows both rate columns at 390px without scrolling`, async ({ page }) => {
    await page.goto(`${locale === "en" ? "/en" : ""}/explorer/inflation/products`);
    const region = page.getByTestId("product-table");
    await region.scrollIntoViewIfNeeded();
    const fit = await region.evaluate((element) => {
      const frame = element.getBoundingClientRect();
      const cells = [...element.querySelectorAll("tbody tr:first-child td, thead th")];
      return {
        scrolls: element.scrollWidth > element.clientWidth,
        outside: cells.filter((cell) => cell.getBoundingClientRect().right > frame.right + 1).length,
        overflowingHeaders: [...element.querySelectorAll("thead th")].filter((th) => th.scrollWidth > th.clientWidth + 1).length,
      };
    });
    expect(fit).toEqual({ scrolls: false, outside: 0, overflowingHeaders: 0 });
    await expect(page.getByTestId("product-table-caption")).toBeVisible();
  });
}
