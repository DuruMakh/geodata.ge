import { expect, test, type Page } from "@playwright/test";

// Mobile polish (2026-10-07 review, owner decisions D8/D11 and the consistency
// items): search placeholders, series denominators, type floor, tap targets,
// word breaking and the phone legend, on a 390px phone.
test.use({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });

async function ready(page: Page) {
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
}

test.describe("search fields follow §7.7", () => {
  for (const { path, testId, placeholder } of [
    { path: "/explorer/expenditure", testId: "series-search", placeholder: "ძებნა" },
    { path: "/explorer/inflation/products", testId: "series-search", placeholder: "ძებნა" },
    { path: "/explorer/inflation/products", testId: "product-list-search", placeholder: "ძებნა" },
    { path: "/explorer/unemployment/overview", testId: "series-search", placeholder: "ძებნა" },
    { path: "/explorer/unemployment/age", testId: "series-search", placeholder: "ძებნა" },
    { path: "/explorer/municipalities", testId: "municipal-search", placeholder: "ძებნა" },
    { path: "/en/explorer/unemployment/overview", testId: "series-search", placeholder: "Search" },
    { path: "/en/explorer/inflation/products", testId: "product-list-search", placeholder: "Search" },
  ]) {
    test(`${path} ${testId}: underline field with the shared placeholder`, async ({ page }) => {
      await page.goto(path);
      await ready(page);
      const field = page.getByTestId(testId).first();
      await expect(field).toHaveAttribute("placeholder", placeholder);
      const style = await field.evaluate((element) => {
        const css = getComputedStyle(element);
        return { top: css.borderTopWidth, bottom: css.borderBottomWidth, height: element.getBoundingClientRect().height };
      });
      expect(style).toEqual({ top: "0px", bottom: "1px", height: 34 });
    });
  }

  for (const [path, placeholder, name] of [
    ["/explorer/economy/regions", "ძებნა", "რეგიონის ძიება"],
    ["/en/explorer/economy/regions", "Search", "Search regions"],
  ] as const) {
    test(`${path}: region search is the underline field too`, async ({ page }) => {
      await page.goto(path);
      const field = page.getByRole("searchbox", { name, exact: true });
      await expect(field).toHaveAttribute("placeholder", placeholder);
      expect(await field.evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe("0px");
    });
  }
});

for (const { path, searchable } of [
  { path: "/explorer/debt", searchable: false },
  { path: "/explorer/deficit", searchable: false },
  { path: "/explorer/inflation/overview", searchable: false },
  { path: "/explorer/inflation/cities", searchable: false },
  { path: "/explorer/inflation/cities/batumi", searchable: true },
  { path: "/explorer/inflation/categories", searchable: true },
]) {
  test(`${path}: a series list of ten rows or fewer has no search field`, async ({ page }) => {
    await page.goto(path);
    await ready(page);
    await expect(page.getByTestId("series-list")).toBeVisible();
    await expect(page.getByTestId("series-search")).toHaveCount(searchable ? 1 : 0);
  });
}

test("unemployment denominators count the top-level rows only (§7.7)", async ({ page }) => {
  await page.goto("/explorer/unemployment/gender");
  await ready(page);
  const status = page.getByTestId("series-status");
  const row = (id: string) => page.locator(`[data-series-id="${id}"]`);
  // Georgia, Men and Women are the three rows the list opens with.
  await expect(page.getByTestId("series-row-toggle")).toHaveCount(3);
  await expect(status).toContainText("3 / 3");
  await row("women:unemployment_rate").locator("button[aria-expanded]").click();
  await row("women:employment_rate").getByTestId("series-row-toggle").click();
  // A ticked row under a caret is reported on its own, never hidden in the top-level count.
  await expect(status).toContainText("3 / 3");
  await expect(status).toContainText("ქვეკატეგორიები 1");
  await page.getByTestId("series-toggle-all").click();
  await page.getByTestId("series-toggle-all").click();
  await expect(status).toHaveText(/3 \/ 3$/);
});

// D8: the smallest informational text on a phone is 11px. Charts (SVG), the
// relief's positioned map labels, screen-reader-only and decorative text are out
// of scope; the year-range strip and the municipal map legend are owned by
// their own repair specs.
async function textBelowFloor(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent?.trim();
      const element = walker.currentNode.parentElement;
      if (!text || !element) continue;
      if (element.closest("svg, figure, .sr-only, [aria-hidden='true'], [data-testid='year-range-strip'], [data-testid='municipality-map']")) continue;
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (box.width === 0 || box.height === 0 || style.visibility === "hidden" || style.opacity === "0") continue;
      const size = parseFloat(style.fontSize);
      if (size < 11) found.push(`${size}px "${text.slice(0, 30)}"`);
    }
    return [...new Set(found)];
  });
}

for (const path of [
  "/",
  "/about",
  "/methodology",
  "/methodology/expenditure",
  "/explorer",
  "/explorer/expenditure",
  "/explorer/municipalities",
  "/explorer/municipalities/batumi",
  "/explorer/analysis",
  "/explorer/economy/regions",
  "/explorer/inflation/categories",
  "/en/explorer/unemployment/overview",
]) {
  test(`${path}: no informational text below 11px on a phone (D8)`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(await textBelowFloor(page)).toEqual([]);
  });
}

test.describe("touch targets (D8)", () => {
  test("the % მშპ-ში pill and the bulk toggle are comfortable to tap", async ({ page }) => {
    await page.goto("/explorer/expenditure");
    await ready(page);
    expect((await page.getByTestId("measure-share-toggle").boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(36);
    expect((await page.getByTestId("series-toggle-all").boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test("a series caret answers taps 44px tall without changing the row", async ({ page }) => {
    await page.goto("/explorer/debt");
    await ready(page);
    const parent = page.locator('[data-series-id="debt.service.total"]');
    const caret = parent.locator("button[aria-expanded]");
    await expect(caret).toHaveAttribute("aria-expanded", "true");
    await parent.scrollIntoViewIfNeeded();
    const rowBox = (await parent.boundingBox())!;
    const caretBox = (await caret.boundingBox())!;
    expect(rowBox.height).toBeLessThan(40);
    // 10px below the row — the first child's empty caret gutter — still reaches this caret.
    const label = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.closest("button")?.getAttribute("aria-label") ?? null,
      { x: caretBox.x + caretBox.width / 2, y: rowBox.y + rowBox.height + 10 },
    );
    expect(label).toBe(await caret.getAttribute("aria-label"));
  });
});

test("desktop keeps its compact type (D8 is phone-only)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/explorer");
  await expect(page.getByTestId("budget-hub").locator("p").last()).toHaveCSS("font-size", "10px");
});

test.describe("a larger text setting (root font 125%) at 360px", () => {
  test.use({ viewport: { width: 360, height: 800 } });
  for (const path of [
    "/",
    "/explorer/expenditure",
    "/explorer/municipalities",
    "/explorer/inflation/products",
    "/explorer/unemployment/overview",
    "/methodology/expenditure",
  ]) {
    test(`${path}: body copy grows and nothing overflows (D8)`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await page.addStyleTag({ content: "html { font-size: 125% !important; }" });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
      // Body copy follows the setting: the footer fine print is rem-sized.
      expect(await page.locator("footer p").last().evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThan(12);
    });
  }
});

// Words split across two lines although they would fit on one line of their
// block — a mid-word break that was not the last resort. Hyphens and slashes
// are normal break points; a word wider than its whole column may still break.
async function wordsBrokenMidWord(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const element = node.parentElement;
      if (!element || element.closest("svg, .sr-only, [aria-hidden='true']") || element.getBoundingClientRect().height === 0) continue;
      for (const match of (node.textContent ?? "").matchAll(/[^\s\-–—/]{4,}/g)) {
        const range = document.createRange();
        range.setStart(node, match.index!);
        range.setEnd(node, match.index! + match[0].length);
        const lines = new Set([...range.getClientRects()].filter((rect) => rect.width > 0).map((rect) => Math.round(rect.top)));
        if (lines.size > 1) found.push(match[0]);
      }
    }
    return [...new Set(found)];
  });
}

for (const path of [
  "/explorer/expenditure",
  "/explorer/expenditure#sel=expenditure.total,spending.other_unclassified,spending.education&view=table",
  "/explorer/expenditure#g=ministries&sel=admin_spending.total,admin_spending.regional_development_infrastructure,admin_spending.health_social_affairs&view=table",
  "/explorer/municipalities/batumi#view=table",
]) {
  test(`${path}: long Georgian words wrap at spaces, not mid-word`, async ({ page }) => {
    await page.goto(path);
    await ready(page);
    expect(await wordsBrokenMidWord(page)).toEqual([]);
  });
}

test("the tap readout replaces the phone legend while it is open (D1 + D4c)", async ({ page }) => {
  await page.goto("/explorer/inflation/cities");
  await ready(page);
  const legend = page.getByTestId("chart-phone-legend");
  await expect(legend).toBeVisible();
  const chart = page.locator("[data-testid='chart-panel'] svg:visible, [data-chart-panel] svg:visible").first();
  await chart.scrollIntoViewIfNeeded();
  const box = (await chart.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await expect(page.locator("[data-placement='panel']")).toBeVisible();
  await expect(legend).toBeHidden();
});

