import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { TEST_BASE_URL } from "./test-base-url";

// D1 (owner-approved 2026-10-07): below 768px the line charts, the stacked
// column charts and the analysis budget field draw at the phone's width instead
// of scrolling a 720px-minimum desktop drawing whose labels rendered at 8.6px.
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

async function ready(page: Page, path: string) {
  await page.goto(`${TEST_BASE_URL}${path}`);
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await page.evaluate(() => document.fonts.ready);
}

type ChartMetrics = {
  testId: string;
  geometry: string | null;
  scrolls: boolean;
  minFont: number;
  xLabels: string[];
  overlaps: string[];
  outside: string[];
  latestAtEnd: boolean;
};

/** Every chart drawing on the page, measured as rendered. */
function measureCharts(page: Page): Promise<ChartMetrics[]> {
  return page.evaluate(() => {
    const drawings: Array<{ testId: string; frame: Element; svg: SVGSVGElement; periodAxis: boolean }> = [];
    for (const frame of document.querySelectorAll('[data-testid="chart-frame"],[data-testid="stack-chart-frame"]')) {
      const svg = frame.querySelector<SVGSVGElement>('svg[role="img"]');
      if (svg) drawings.push({ testId: frame.getAttribute("data-testid")!, frame, svg, periodAxis: true });
    }
    const field = document.querySelector<SVGSVGElement>('[data-testid="budget-field"] svg');
    if (field) drawings.push({ testId: "budget-field", frame: field.parentElement!.parentElement!, svg: field, periodAxis: false });

    return drawings.map(({ testId, frame, svg, periodAxis }) => {
      const box = svg.getBoundingClientRect();
      const viewBox = svg.viewBox.baseVal;
      const scale = box.width / viewBox.width;
      const texts = [...svg.querySelectorAll("text")].map((text) => ({
        text: text.textContent ?? "",
        box: text.getBoundingClientRect(),
        size: Number(text.getAttribute("font-size")) * scale,
        y: Number(text.getAttribute("y")),
      }));
      const xLabels = texts.filter((text) => text.y >= viewBox.height - 16).sort((a, b) => a.box.left - b.box.left);
      const overlaps: string[] = [];
      for (let index = 1; index < xLabels.length; index += 1) {
        if (xLabels[index]!.box.left < xLabels[index - 1]!.box.right + 1) overlaps.push(`${xLabels[index - 1]!.text}|${xLabels[index]!.text}`);
      }
      const last = xLabels.at(-1);
      return {
        testId,
        geometry: svg.getAttribute("data-geometry"),
        scrolls: frame.scrollWidth > frame.clientWidth + 1,
        minFont: Math.min(...texts.map((text) => text.size)),
        xLabels: xLabels.map((text) => text.text),
        overlaps,
        outside: texts.filter((text) => text.box.left < box.left - 0.5 || text.box.right > box.right + 0.5).map((text) => text.text),
        // The latest period closes the axis, fully on screen.
        latestAtEnd: !periodAxis || (last !== undefined && last.box.right <= Math.min(box.right, innerWidth) + 0.5 && last.box.right >= box.right - 40),
      };
    });
  });
}

function expectFitted(path: string, charts: ChartMetrics[]) {
  expect(charts.length, path).toBeGreaterThan(0);
  for (const chart of charts) {
    const where = `${path} ${chart.testId}`;
    expect(chart.geometry, where).toBe("mobile");
    expect(chart.scrolls, where).toBe(false);
    expect(chart.minFont, where).toBeGreaterThanOrEqual(10);
    expect(chart.overlaps, where).toEqual([]);
    expect(chart.outside, where).toEqual([]);
    expect(chart.latestAtEnd, where).toBe(true);
  }
}

const fittedPages = [
  "/explorer/expenditure",
  "/explorer/revenue",
  "/explorer/debt",
  "/explorer/deficit",
  "/explorer/municipalities/georgia",
  "/explorer/municipalities/batumi",
  "/explorer/analysis",
  "/explorer/economy/gdp",
  "/explorer/economy/gdp#indicator=growth",
  "/explorer/economy/sectors",
  "/explorer/economy/regions/adjara",
  "/explorer/inflation/overview",
  "/explorer/inflation/categories",
  "/explorer/inflation/products",
  "/explorer/inflation/cities",
  "/explorer/inflation/cities/batumi",
  "/explorer/unemployment/overview",
  "/explorer/unemployment/overview#indicator=unemployed",
  "/explorer/unemployment/regions/adjara",
  "/explorer/unemployment/age",
  "/explorer/unemployment/gender",
];

test("charts fit a 390px phone: no sideways scroll, legible and collision-free labels, latest period on screen", async ({ page }) => {
  test.setTimeout(180_000);
  for (const path of fittedPages) {
    await ready(page, path);
    expectFitted(path, await measureCharts(page));
  }
});

test("charts fit a 360px phone in English", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 360, height: 780 });
  for (const path of ["/explorer/expenditure", "/explorer/economy/gdp", "/explorer/inflation/categories", "/explorer/unemployment/overview", "/explorer/analysis"]) {
    await ready(page, `/en${path}`);
    expectFitted(path, await measureCharts(page));
  }
});

test("phone axes print the amount unit once and plain numbers on the ticks", async ({ page }) => {
  await ready(page, "/explorer/expenditure");
  const svg = page.getByTestId("chart-frame").locator('svg[role="img"]');
  await expect(svg.locator("text[data-unit-caption]")).toHaveText("მლრდ");
  const ticks = await svg.locator('text[text-anchor="end"]').allTextContents();
  expect(ticks.length).toBeGreaterThan(2);
  for (const tick of ticks) expect(tick).toMatch(/^−?[\d.,]+$/);
});

test("phones skip the sticky axis and the scroll position logic", async ({ page }) => {
  await ready(page, "/explorer/expenditure");
  const frame = page.getByTestId("chart-frame");
  await expect(page.getByTestId("chart-frame-y-axis")).toHaveCount(0);
  expect(await frame.evaluate((element) => [element.scrollLeft, element.scrollWidth - element.clientWidth])).toEqual([0, 0]);
  // Still a named region; with nothing to scroll, the chart inside is the keyboard stop.
  await expect(frame).not.toHaveAttribute("tabindex");
  await expect(frame).toHaveAttribute("role", "region");
  await expect(frame.locator('svg[role="img"]')).toHaveAttribute("tabindex", "0");
});

// The pinned tooltip floated over the plot; with ten inflation categories it
// covered the whole phone chart. The readout now sits under the chart.
for (const [path, frameId, readoutId] of [
  ["/explorer/expenditure", "chart-frame", "chart-tooltip"],
  ["/explorer/inflation/categories", "stack-chart-frame", "stack-chart-tooltip"],
  ["/explorer/unemployment/overview", "stack-chart-frame", "stack-chart-tooltip"],
] as const) {
  test(`a tap reads ${frameId} in a panel under the chart (${path})`, async ({ page }) => {
    await ready(page, path);
    const frame = page.getByTestId(frameId).first();
    await frame.scrollIntoViewIfNeeded();
    const box = (await frame.boundingBox())!;
    const readout = page.getByTestId(readoutId);

    await page.touchscreen.tap(box.x + box.width * 0.8, box.y + box.height * 0.5);
    await expect(readout).toBeVisible();
    await expect(readout).toHaveAttribute("data-placement", "panel");
    const panel = (await readout.boundingBox())!;
    expect(panel.y).toBeGreaterThanOrEqual(box.y + box.height - 0.5);
    expect(panel.x).toBeGreaterThanOrEqual(box.x - 0.5);
    expect(panel.x + panel.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
    expect(await readout.evaluate((element) => parseFloat(getComputedStyle(element.querySelector("span")!).fontSize))).toBeGreaterThanOrEqual(12);

    // The same period again lets it go; a tap elsewhere does too.
    await page.touchscreen.tap(box.x + box.width * 0.8, box.y + box.height * 0.5);
    await expect(readout).toHaveCount(0);
    await page.touchscreen.tap(box.x + box.width * 0.4, box.y + box.height * 0.5);
    await expect(readout).toBeVisible();
    await page.getByRole("heading", { level: 1 }).tap();
    await expect(readout).toHaveCount(0);
  });
}

test("a tap on a budget-field circle reads its name, amount and growth under the field", async ({ page }) => {
  await ready(page, "/explorer/analysis");
  const field = page.getByTestId("budget-field");
  const svg = field.locator("svg");
  await svg.scrollIntoViewIfNeeded();
  const svgBox = (await svg.boundingBox())!;
  const circles = field.locator("circle");
  expect(await circles.count()).toBeGreaterThan(3);
  for (const circle of await circles.all()) {
    const circleBox = (await circle.boundingBox())!;
    expect(circleBox.x).toBeGreaterThanOrEqual(svgBox.x - 0.5);
    expect(circleBox.x + circleBox.width).toBeLessThanOrEqual(svgBox.x + svgBox.width + 0.5);
  }

  const largest = circles.first();
  const circleBox = (await largest.boundingBox())!;
  await page.touchscreen.tap(circleBox.x + circleBox.width / 2, circleBox.y + circleBox.height / 2);
  const readout = page.getByTestId("budget-field-tooltip");
  await expect(readout).toBeVisible();
  await expect(readout).toHaveAttribute("data-placement", "panel");
  await expect(readout).toContainText(/ცვლილება [+−]?\d/);
  expect((await readout.boundingBox())!.y).toBeGreaterThanOrEqual(svgBox.y + svgBox.height - 0.5);
  await page.getByRole("heading", { level: 1 }).tap();
  await expect(readout).toHaveCount(0);
});

test("landscape phones and desktops keep the desktop drawing", async ({ page }) => {
  for (const viewport of [{ width: 844, height: 390 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await ready(page, "/explorer/expenditure");
    const svg = page.getByTestId("chart-frame").locator('svg[role="img"]');
    await expect(svg).toHaveCount(1);
    await expect(svg).toHaveAttribute("data-geometry", "desktop");
    await expect(svg).toHaveAttribute("viewBox", "0 0 920 320");
  }
});

test.describe("before hydration", () => {
  test.use({ javaScriptEnabled: false });

  // The static HTML carries both drawings and CSS shows the phone one, so a
  // slow phone never paints the scrolling desktop chart first.
  test("the server HTML already shows the phone drawing", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
    const frame = page.getByTestId("chart-frame");
    await expect(frame.locator('svg[data-geometry="mobile"]')).toBeVisible();
    await expect(frame.locator('svg[data-geometry="desktop"]')).toBeHidden();
    expect(await frame.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  });
});

test("rotating a phone swaps the drawing without a reload", async ({ page }) => {
  await ready(page, "/explorer/expenditure");
  const svg = page.getByTestId("chart-frame").locator('svg[role="img"]');
  await expect(svg).toHaveAttribute("data-geometry", "mobile");
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(svg).toHaveAttribute("data-geometry", "desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(svg).toHaveAttribute("data-geometry", "mobile");
});

// DESIGN.md §17: under a page's H1 only one small one-line text. One page per
// explorer route: the published page list (page-revisions.json, the set
// sitemap.ts publishes) collapsed to one path per app route, so a new page or
// a new region family is covered without editing this list.
function explorerRoutes(): { missing: string[]; pages: Array<{ template: string; path: string }> } {
  const templates: string[] = [];
  const walk = (dir: string, route: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(dir, entry.name), `${route}/${entry.name}`);
      else if (entry.name === "page.tsx") templates.push(route);
    }
  };
  walk(resolve(process.cwd(), "app/(ka)/explorer"), "/explorer");
  const published = Object.keys(JSON.parse(readFileSync(resolve(process.cwd(), "../../data/localization/en/page-revisions.json"), "utf8")))
    .filter((page) => page === "/explorer" || page.startsWith("/explorer/"));
  const matches = (template: string, page: string) => new RegExp(`^${template.replace(/\[[^\]]+\]/g, "[^/]+")}$`).test(page);
  const chosen = new Map<string, string>();
  for (const page of published) {
    const template = templates.find((item) => item === page) ?? templates.find((item) => matches(item, page));
    if (template && !chosen.has(template)) chosen.set(template, page);
  }
  return { missing: templates.filter((template) => !chosen.has(template)), pages: [...chosen].map(([template, path]) => ({ template, path })) };
}

// Trade and External flows show nothing between the heading and the controls (D188).
const bareHeadingPages = [
  "/explorer/trade/overview",
  "/explorer/trade/partners",
  "/explorer/trade/products",
  "/explorer/trade/domestic-exports",
  "/explorer/trade/services",
  "/explorer/external/money-from-abroad",
  "/explorer/external/foreign-investment",
  "/explorer/external/current-account",
];

// Latest-value, deck and place lines that still wrap at 375px. Shortening them
// is the owner's wording call (Task 18 report); each entry is an expected failure,
// so fixing a page fails its test until the entry is removed here.
const wrappingLines: Record<string, readonly ("ka" | "en")[]> = {
  "/explorer/analysis": ["ka", "en"],
  "/explorer/debt": ["ka", "en"],
  "/explorer/deficit": ["ka", "en"],
  "/explorer/municipalities/georgia": ["ka", "en"],
  "/explorer/municipalities/[slug]": ["ka"],
  "/explorer/municipalities/region/[id]": ["ka", "en"],
  "/explorer/demography/population/region/[id]": ["ka"],
  "/explorer/economy/sectors": ["ka", "en"],
  "/explorer/wages/regions/[id]": ["ka"],
  "/explorer/energy-food/energy-supply": ["ka"],
  "/explorer/energy-food/electricity": ["ka", "en"],
  "/explorer/money/bank-health": ["ka"],
  "/explorer/living-standards/income": ["ka", "en"],
  "/explorer/living-standards/income/regions/[id]": ["ka", "en"],
  "/explorer/living-standards/spending": ["ka", "en"],
  "/explorer/living-standards/spending/regions/[id]": ["ka", "en"],
};

const routes = explorerRoutes();

test("every explorer route template has a published page to check", () => {
  expect(routes.missing).toEqual([]);
  expect(routes.pages.length).toBeGreaterThan(60);
});

for (const locale of ["ka", "en"] as const) {
  for (const { template, path: route } of routes.pages) {
    test(`one short line under the heading at 375px (DESIGN §17): ${locale} ${route}`, async ({ page }) => {
      test.fail(wrappingLines[template]?.includes(locale) ?? false, "the line under the heading still wraps at 375px; wording awaits the owner");
      await page.setViewportSize({ width: 375, height: 812 });
      // Hubs are static and never mark the app ready; the line is in the served HTML.
      await page.goto(`${TEST_BASE_URL}${locale === "en" ? "/en" : ""}${route}`);
      await page.evaluate(() => document.fonts.ready);
      const after = await page.getByRole("heading", { level: 1 }).first().evaluate((heading) => {
        // A place heading wraps the h1 with its closed picker and its previous/next
        // links; the line under the heading follows that block.
        const skipped = (element: Element) => element.matches('[data-testid$="-navigation"], .sr-only');
        let block: Element = heading;
        let next = block.nextElementSibling;
        for (;;) {
          while (next && skipped(next)) next = next.nextElementSibling;
          if (next || !block.parentElement || block.parentElement.tagName === "MAIN") break;
          block = block.parentElement;
          next = block.nextElementSibling;
        }
        if (!(next instanceof HTMLElement)) return null;
        // Text is a line to measure; anything holding controls or a chart is the workspace.
        const text = !next.querySelector("button, input, select, svg, table, section, div");
        return { tag: next.tagName, text, lines: next.getBoundingClientRect().height / parseFloat(getComputedStyle(next).lineHeight), content: next.textContent };
      });
      if (bareHeadingPages.includes(route)) {
        expect(after?.text ?? false, `${route}: ${after?.content}`).toBe(false);
        expect(after?.tag).not.toBe("P");
      } else if (after?.text) {
        expect(after.lines, `${route}: ${after.content}`).toBeLessThanOrEqual(1.6);
      }
    });
  }
}
