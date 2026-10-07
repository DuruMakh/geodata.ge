import { expect, test, type Page } from "@playwright/test";
import { TEST_BASE_URL } from "./test-base-url";

// Phone-width regressions for the shared SVG charts (2026-10-07 mobile review).
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

async function ready(page: Page, path: string) {
  await page.goto(`${TEST_BASE_URL}${path}`);
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await page.evaluate(() => document.fonts.ready);
}

const regionSlugs = [
  "tbilisi",
  "adjara",
  "guria",
  "imereti",
  "kakheti",
  "mtskheta_mtianeti",
  "racha_lechkhumi_kvemo_svaneti",
  "samegrelo_zemo_svaneti",
  "samtskhe_javakheti",
  "kvemo_kartli",
  "shida_kartli",
];

const axisPages = [
  "/explorer/expenditure",
  "/explorer/revenue",
  "/explorer/debt",
  "/explorer/municipalities/georgia",
  "/explorer/municipalities/batumi",
  "/explorer/unemployment/overview#indicator=unemployed",
  ...regionSlugs.map((slug) => `/explorer/economy/regions/${slug}`),
];

const atEnd = (frame: import("@playwright/test").Locator) =>
  frame.evaluate((element) => element.scrollWidth - element.clientWidth - element.scrollLeft);

// Charts opened on the oldest data, so the current value was never on a phone's
// first screen; once scrolled to it, the y axis had scrolled away with the plot.
for (const [path, testId] of [
  ["/explorer/expenditure", "chart-frame"],
  ["/explorer/inflation/categories", "stack-chart-frame"],
] as const) {
  test(`${testId} opens at the latest data and keeps its y axis in view (${path})`, async ({ page }) => {
    await ready(page, path);
    const frame = page.getByTestId(testId).first();
    expect(await frame.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    await expect.poll(() => atEnd(frame)).toBeLessThanOrEqual(1);

    const axis = page.getByTestId(`${testId}-y-axis`).first();
    await expect(axis).toBeVisible();
    const frameBox = (await frame.boundingBox())!;
    expect(Math.abs((await axis.boundingBox())!.x - frameBox.x)).toBeLessThanOrEqual(1);
    const plotLabels = await frame.locator('svg[role="img"] text[text-anchor="end"]').allTextContents();
    const stickyLabels = await axis.locator("text").allTextContents();
    expect(stickyLabels.length).toBeGreaterThan(1);
    expect(plotLabels).toEqual(expect.arrayContaining(stickyLabels));

    // Mid-scroll the copy still sits at the frame's left edge.
    await frame.evaluate((element) => element.scrollTo({ left: element.scrollWidth / 3 }));
    await expect.poll(async () => Math.abs((await axis.boundingBox())!.x - frameBox.x)).toBeLessThanOrEqual(1);
  });
}

// Charts only listened to pointermove/pointerleave, so touch never showed a value.
for (const [path, frameId, tooltipId] of [
  ["/explorer/expenditure", "chart-frame", "chart-tooltip"],
  ["/explorer/unemployment/overview", "stack-chart-frame", "stack-chart-tooltip"],
] as const) {
  test(`a tap reads ${frameId} inside the visible frame (${path})`, async ({ page }) => {
    await ready(page, path);
    const frame = page.getByTestId(frameId).first();
    await frame.scrollIntoViewIfNeeded();
    const box = (await frame.boundingBox())!;
    const tooltip = page.getByTestId(tooltipId);

    for (const fraction of [0.2, 0.8]) {
      await page.touchscreen.tap(box.x + box.width * fraction, box.y + box.height * 0.5);
      await expect(tooltip).toBeVisible();
      await expect(tooltip).toHaveAttribute("data-pinned", fraction < 0.5 ? "right" : "left");
      const tip = (await tooltip.boundingBox())!;
      expect(tip.x).toBeGreaterThanOrEqual(box.x);
      expect(tip.x + tip.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
      expect(tip.width).toBeGreaterThan(150);

      // The same period again lets it go.
      await page.touchscreen.tap(box.x + box.width * fraction, box.y + box.height * 0.5);
      await expect(tooltip).toHaveCount(0);
    }

    // A tap anywhere else lets it go too.
    await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await expect(tooltip).toBeVisible();
    await page.getByRole("heading", { level: 1 }).tap();
    await expect(tooltip).toHaveCount(0);
  });
}

test("a vertical swipe over a chart still scrolls the page", async ({ page }) => {
  await ready(page, "/explorer/expenditure");
  const frame = page.getByTestId("chart-frame");
  await frame.scrollIntoViewIfNeeded();
  const box = (await frame.boundingBox())!;
  const before = await page.evaluate(() => scrollY);
  const cdp = await page.context().newCDPSession(page);
  const x = box.x + box.width / 2;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: box.y + box.height - 10 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: box.y + box.height / 2 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: box.y + 10 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before);
  await expect(page.getByTestId("chart-tooltip")).toHaveCount(0);
});

test("a range change re-opens the chart at the latest data", async ({ page }) => {
  await ready(page, "/explorer/expenditure");
  const frame = page.getByTestId("chart-frame");
  await frame.evaluate((element) => element.scrollTo({ left: 0 }));
  await expect.poll(() => frame.evaluate((element) => element.scrollLeft)).toBe(0);
  await page.getByTestId("range-start-handle").press("ArrowRight");
  await expect.poll(() => atEnd(frame)).toBeLessThanOrEqual(1);
});

test("a chart that fits keeps its scroll position and draws no sticky axis", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await ready(page, "/explorer/expenditure");
  const frame = page.getByTestId("chart-frame");
  expect(await frame.evaluate((element) => [element.scrollLeft, element.scrollWidth - element.clientWidth])).toEqual([0, 0]);
  await expect(page.getByTestId("chart-frame-y-axis")).toHaveCount(0);
});

for (const prefix of ["", "/en"]) {
  // A fixed 74-unit left padding clipped the first digit of 9-character labels:
  // "50.0 მლრდ" read "0.0 მლრდ" at the top of the expenditure axis.
  test(`y-axis labels keep their first character ${prefix || "ka"}`, async ({ page }) => {
    for (const path of axisPages) {
      await ready(page, `${prefix}${path}`);
      const leftEdges = await page
        .locator('[data-testid="chart-frame"] svg[role="img"] text[text-anchor="end"]')
        .evaluateAll((nodes) => nodes.map((node) => [node.textContent, (node as SVGGraphicsElement).getBBox().x] as const));
      expect(leftEdges.length, path).toBeGreaterThan(1);
      for (const [label, x] of leftEdges) expect(x, `${path} ${label}`).toBeGreaterThanOrEqual(0);
    }
  });
}
