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

const cases = [
  { name: "expenditure with a long-label series", path: `/explorer/expenditure${longLabelSelection}` },
  { name: "English expenditure with a long-label series", path: `/en/explorer/expenditure${longLabelSelection}` },
  { name: "Georgia municipal aggregate", path: "/explorer/municipalities/georgia#m=table" },
  { name: "Batumi", path: "/explorer/municipalities/batumi#m=table" },
];

for (const { name, path } of cases) {
  test(`table mode shows year values at 390px: ${name}`, async ({ page }) => {
    await page.goto(path);
    const scroller = page.getByTestId("explorer-table");
    await scroller.scrollIntoViewIfNeeded();
    await expect(scroller.locator("tbody tr").first()).toBeVisible();
    // The table opens on the latest year, so the latest-year column is in view.
    await expect.poll(() => scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await expect.poll(() => visibleYearCells(scroller)).toBeGreaterThanOrEqual(2);
    const latestVisible = await scroller.evaluate((element) => {
      const latest = element.querySelector("thead th[data-latest-year]")!.getBoundingClientRect();
      const frame = element.getBoundingClientRect();
      return latest.right <= frame.right + 1 && latest.left >= frame.left;
    });
    expect(latestVisible).toBe(true);
    // The sticky label column leaves most of the scroller to the numbers.
    const labelWidth = await scroller.locator("thead th").first().evaluate((th) => th.getBoundingClientRect().width);
    const frameWidth = await scroller.evaluate((element) => element.clientWidth);
    expect(labelWidth).toBeLessThanOrEqual(frameWidth * 0.45);
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

