import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { computedCssColorAlpha } from "./focus-outline";

// Landing page (GeoData Site v2 design): structure, live data blocks, and the
// paths into the explorer. The hero is WebGL; tests assert the canvas mounts
// (or the fallback message shows) rather than pixel content.

const artifactDir = join(process.cwd(), "test-results", "visual-reference");
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";
const heroRuntimeMarkers = ["WebGLRenderer", "ვიზუალი ვერ ჩაიტვირთა"] as const;

async function heroRuntimeScripts(request: APIRequestContext, urls: Iterable<string>) {
  const uniqueUrls = [...new Set(urls)];
  const matches = await Promise.all(
    uniqueUrls.map(async (url) => {
      const response = await request.get(url);
      if (!response.ok()) return null;
      const body = await response.text();
      return heroRuntimeMarkers.every((marker) => body.includes(marker)) ? url : null;
    }),
  );
  return matches.filter((url): url is string => url !== null);
}

function installHeroDrawInstrumentation() {
  const counts: number[] = [];
  const testWindow = window as typeof window & {
    __heroDrawCounts: number[];
    __heroTerrainDrawCount: number;
  };
  testWindow.__heroDrawCounts = counts;
  testWindow.__heroTerrainDrawCount = 0;
  type DrawArraysOwner = { drawArrays: (mode: number, first: number, count: number) => void };
  const wrap = (prototype: DrawArraysOwner) => {
    const original = prototype.drawArrays;
    prototype.drawArrays = function (this: DrawArraysOwner, mode, first, count) {
      counts.push(count);
      if (count > 1_000) testWindow.__heroTerrainDrawCount = count;
      original.call(this, mode, first, count);
    };
  };
  wrap(WebGLRenderingContext.prototype);
  if (typeof WebGL2RenderingContext !== "undefined") wrap(WebGL2RenderingContext.prototype);
}

async function capture(page: Page, name: string) {
  await mkdir(artifactDir, { recursive: true });
  await page.waitForTimeout(2500); // let the hero's geological entry settle
  // Viewport capture: full-page stitching drops the WebGL hero layer.
  await page.screenshot({ path: join(artifactDir, `${name}.png`), caret: "hide" });
}

async function expectNoPageOverflow(page: Page) {
  const width = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(width.scroll).toBe(width.client);
}

async function expectMinimumTarget(locator: Locator, size = 24) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(size);
  expect(box!.height).toBeGreaterThanOrEqual(size);
}

async function expectNonOverlappingTargets(locator: Locator) {
  const boxes = await Promise.all((await locator.all()).map((target) => target.boundingBox()));
  expect(boxes.every((box) => box !== null)).toBe(true);

  for (let first = 0; first < boxes.length; first += 1) {
    for (let second = first + 1; second < boxes.length; second += 1) {
      const a = boxes[first]!;
      const b = boxes[second]!;
      const overlaps = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
      expect(overlaps, `targets ${first} and ${second} overlap`).toBe(false);
    }
  }
}

async function expectVisibleFocusOutline(locator: Locator) {
  await locator.focus();
  await expect(locator).toBeFocused();
  const outline = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      color: style.outlineColor,
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
    };
  });
  expect(outline.style).not.toBe("none");
  expect(outline.width).toBeGreaterThan(0);
  expect(computedCssColorAlpha(outline.color)).toBeGreaterThan(0);
}

async function expectKeyboardFocusOrder(page: Page, locator: Locator) {
  const links = await locator.all();
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);

  for (let index = 0; index < links.length; index += 1) {
    const link = links[index]!;
    let reachedTarget = false;

    for (let tab = 0; tab < 100; tab += 1) {
      await page.keyboard.press("Tab");
      const focusedIndex = await locator.evaluateAll((elements) => elements.findIndex((element) => element === document.activeElement));
      expect(focusedIndex, `target ${index} was skipped in keyboard order`).not.toBeGreaterThan(index);
      if (focusedIndex !== index) continue;

      await expect(link).toBeFocused();
      const outline = await link.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          color: style.outlineColor,
          style: style.outlineStyle,
          width: Number.parseFloat(style.outlineWidth),
        };
      });
      expect(await link.evaluate((element) => element.matches(":focus-visible"))).toBe(true);
      expect(outline.style).not.toBe("none");
      expect(outline.width).toBeGreaterThan(0);
      expect(computedCssColorAlpha(outline.color)).toBeGreaterThan(0);
      reachedTarget = true;
      break;
    }

    expect(reachedTarget, `target ${index} was not reached by Tab`).toBe(true);
  }
}

async function expectDatasetTableFits(page: Page, testId: string) {
  const section = page.getByTestId(testId);
  await expect(section.locator("tbody tr")).toHaveCount(4);
  const geometry = await section.locator("table").evaluate((table) => {
    const tableBox = table.getBoundingClientRect();
    const parentBox = table.parentElement!.getBoundingClientRect();
    const cells = Array.from(table.querySelectorAll("th, td"))
      .filter((cell) => {
        const style = getComputedStyle(cell);
        const box = cell.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
      })
      .map((cell) => {
        const box = cell.getBoundingClientRect();
        return {
          clientWidth: cell.clientWidth,
          left: box.left,
          right: box.right,
          scrollWidth: cell.scrollWidth,
          text: cell.textContent?.trim() ?? "",
        };
      });
    return {
      cells,
      tableLeft: tableBox.left,
      tableRight: tableBox.right,
      parentLeft: parentBox.left,
      parentRight: parentBox.right,
    };
  });
  expect(geometry.tableLeft).toBeGreaterThanOrEqual(geometry.parentLeft);
  expect(geometry.tableRight).toBeLessThanOrEqual(geometry.parentRight + 0.5);
  for (const cell of geometry.cells) {
    expect(cell.left, `${testId}: left edge of "${cell.text}"`).toBeGreaterThanOrEqual(geometry.tableLeft - 0.5);
    expect(cell.right, `${testId}: right edge of "${cell.text}"`).toBeLessThanOrEqual(geometry.tableRight + 0.5);
    expect(cell.scrollWidth, `${testId}: clipped content in "${cell.text}"`).toBeLessThanOrEqual(cell.clientWidth);
  }
}

test("landing renders the approved latest-year data composition", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(baseUrl);

  await expect(page).toHaveTitle("საქართველოს ბიუჯეტი და მუნიციპალური მონაცემები | Fiscal.ge");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "საქართველოს სახელმწიფო და მუნიციპალური ბიუჯეტების გადამოწმებული მონაცემები — ხარჯები, შემოსავლები, მუნიციპალიტეტები, მეთოდოლოგია და ჩამოსატვირთი მონაცემები.",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("საქართველო ციფრებში");
  await expect(page.getByText("საქართველოს მონაცემების პორტალი", { exact: true })).toBeVisible();
  await expect(page.getByTestId("hero-cta")).toHaveText("გაეცანი მონაცემებს");
  await expect(page.getByTestId("hero-cta")).toHaveAttribute("href", "#data");
  await expect(page.locator("figure canvas").or(page.getByText("ვიზუალი ვერ ჩაიტვირთა"))).toBeVisible({ timeout: 15_000 });

  const figures = page.getByTestId("key-numbers");
  await expect(figures).toContainText("3.9");
  await expect(figures).toContainText("2026 წლის 1 იანვარი · საქსტატი");
  await expect(figures).toContainText("69.7");
  await expect(figures).toContainText("104.6");
  await expectNoPageOverflow(page);

  const orderedHeadings = await page.locator("#data h2").allTextContents();
  expect(orderedHeadings).toEqual([
    "როგორ იხარჯება საქართველოს ბიუჯეტი",
    "როგორ ფინანსდება საქართველოს ბიუჯეტი",
    "როგორ ხარჯავენ ბიუჯეტს საქართველოს მუნიციპალიტეტები",
    "მეთოდოლოგია და პირველწყაროები",
  ]);
  const landingData = page.getByTestId("landing-data");
  const expenditureSection = page.getByTestId("landing-dataset-expenditure");
  await expect(page.getByTestId("landing-data-header")).toHaveCount(0);
  await expect(page.getByText("საჯარო ფინანსების წლიური", { exact: true })).toHaveCount(0);
  await expect(page.getByText("ბოლო ხელმისაწვდომი წელი · 2025", { exact: true })).toHaveCount(0);
  await expect(landingData.locator(':scope > [data-testid="landing-dataset-expenditure"]')).toHaveCount(1);
  expect(
    await landingData.locator(":scope > *").evaluateAll((elements) => elements.map((element) => element.getAttribute("data-testid"))),
  ).toEqual([
    "landing-dataset-expenditure",
    "landing-dataset-revenue",
    "landing-dataset-municipalities",
    "landing-methodology",
  ]);
  await expect(landingData).toHaveCSS("border-top-width", "2px");
  await expect(expenditureSection).toHaveCSS("border-top-width", "0px");

  for (const testId of [
    "landing-dataset-expenditure",
    "landing-dataset-revenue",
    "landing-dataset-municipalities",
  ]) {
    const section = page.getByTestId(testId);
    await expect(section.getByTestId("landing-dataset-total")).toBeVisible();
    await expectDatasetTableFits(page, testId);
    await expect(section.locator("tbody tr").first().getByRole("rowheader")).not.toBeEmpty();
    await expect(section.locator("tbody tr").first().getByRole("cell")).toHaveCount(2);
    const latestYear = await section.getByTestId("landing-dataset-total").locator("strong").textContent();
    await expect(section.locator("thead th").nth(1)).toHaveText(latestYear!);
  }
  await expect(page.getByTestId("landing-dataset-expenditure").locator("table caption")).toHaveText(
    "როგორ იხარჯება საქართველოს ბიუჯეტი — 2025 წლის მონაცემები",
  );
  await expect(
    page.getByTestId("landing-dataset-expenditure").getByRole("table", {
      name: "როგორ იხარჯება საქართველოს ბიუჯეტი — 2025 წლის მონაცემები",
    }),
  ).toHaveCount(1);
  await expect(page.getByTestId("landing-dataset-revenue").locator("table caption")).toHaveText(
    "როგორ ფინანსდება საქართველოს ბიუჯეტი — 2025 წლის მონაცემები",
  );
  await expect(page.getByTestId("landing-dataset-municipalities").locator("table caption")).toHaveText(
    "როგორ ხარჯავენ ბიუჯეტს საქართველოს მუნიციპალიტეტები — 2025 წლის მონაცემები",
  );

  await expect(page.getByTestId("landing-dataset-expenditure").getByRole("link")).toHaveAttribute("href", "/explorer/expenditure");
  await expect(page.getByTestId("landing-dataset-revenue").getByRole("link")).toHaveAttribute("href", "/explorer/revenue");
  await expect(page.getByTestId("landing-dataset-municipalities").getByRole("link")).toHaveAttribute("href", "/explorer/municipalities");
  await expect(page.getByText("უდიდესი მუნიციპალური ბიუჯეტები", { exact: true })).toBeVisible();
  await expect(page.getByTestId("landing-methodology").getByRole("link", { name: "მეთოდოლოგიის ნახვა →" })).toHaveAttribute("href", "/methodology");

  await expect(page.getByTestId("landing-data").locator("svg, canvas")).toHaveCount(0);
  await expect(page.getByTestId("three-paths")).toHaveCount(0);
  await expect(page.getByTestId("waffle-grid")).toHaveCount(0);
  await expect(page.getByTestId("excel-preview")).toHaveCount(0);
  await expect(page.getByTestId("methodology-promo")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "რა არის Fiscal.ge?" })).toHaveCount(0);

  const footer = page.getByTestId("landing-footer");
  await expect(footer.getByRole("link", { name: "info@fiscal.ge" })).toHaveAttribute("href", "mailto:info@fiscal.ge");
  await expect(footer).toContainText("CC BY 4.0");
  await capture(page, "landing-desktop");
});

test("landing data and methodology links use real destinations", async ({ page }) => {
  await page.goto(baseUrl);
  const dataNav = page.getByTestId("landing-header").getByRole("link", { name: "მონაცემები", exact: true });
  await expect(dataNav).toHaveAttribute("href", "/explorer");
  await expect(page.getByTestId("landing-header").getByRole("link", { name: "ექსპლორერი", exact: true })).toHaveCount(0);
  await page.getByTestId("hero-cta").click();
  await expect(page).toHaveURL(/\/#data$/);
  await expect(page.getByTestId("landing-data")).toBeInViewport();

  await page.getByTestId("landing-dataset-revenue").getByRole("link").click();
  await expect(page).toHaveURL(/\/explorer\/revenue/);
  await expect(page.getByTestId("explorer-shell")).toBeVisible();
});

test("landing loads the hero font successfully without requesting it on other routes", async ({ browser, page }) => {
  const fontResponses: Array<{ status: number; url: string }> = [];
  page.on("response", (response) => {
    if (response.url().includes("EurostileGEOMt-Demi")) {
      fontResponses.push({ status: response.status(), url: response.url() });
    }
  });

  await page.goto(baseUrl);
  const heading = page.getByRole("heading", { level: 1, name: "საქართველო ციფრებში" });
  const fontState = await heading.evaluate(async (element) => {
    const descriptor = '600 40px "heroDisplay"';
    const loadedFaces = await document.fonts.load(descriptor, element.textContent ?? "");
    await document.fonts.ready;
    return {
      family: getComputedStyle(element).fontFamily,
      loadedFaces: loadedFaces.length,
      ready: document.fonts.check(descriptor, element.textContent ?? ""),
      stylesheets: document.querySelectorAll('link[rel="stylesheet"]').length,
    };
  });

  expect(fontState).toEqual({
    family: 'heroDisplay, "heroDisplay Fallback", "Noto Serif Georgian", serif',
    loadedFaces: 1,
    ready: true,
    stylesheets: 1,
  });
  expect(fontResponses).toHaveLength(1);
  expect(fontResponses[0]?.status).toBe(200);
  expect(new URL(fontResponses[0]!.url).pathname).toMatch(/\/EurostileGEOMt-Demi\.[^/]+\.ttf$/);

  const nonHomeContext = await browser.newContext();
  try {
    const nonHomePage = await nonHomeContext.newPage();
    await nonHomePage.goto(`${baseUrl}/explorer/expenditure`);
    await nonHomePage.evaluate(() => document.fonts.ready.then(() => undefined));
    const nonHomeFontRequests = await nonHomePage.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((url) => url.includes("EurostileGEOMt-Demi")),
    );
    expect(nonHomeFontRequests).toEqual([]);
  } finally {
    await nonHomeContext.close();
  }
});

test("landing waits for the post-load idle timeout before requesting the WebGL hero", async ({ page, request }) => {
  const scriptRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith(".js")) scriptRequests.push(request.url());
  });
  await page.addInitScript(() => {
    const callbacks = new Map<number, IdleRequestCallback>();
    let nextId = 1;
    const testWindow = window as typeof window & {
      __flushHeroIdle: (didTimeout?: boolean) => void;
      __heroIdlePending: () => number;
      __heroIdleTimeout: () => number | undefined;
    };
    const requestedTimeouts: number[] = [];
    testWindow.__heroIdlePending = () => callbacks.size;
    testWindow.__heroIdleTimeout = () => requestedTimeouts.at(-1);
    testWindow.__flushHeroIdle = (didTimeout = false) => {
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach((callback) => callback({ didTimeout, timeRemaining: () => (didTimeout ? 0 : 50) }));
    };
    window.requestIdleCallback = (callback, options) => {
      if (options?.timeout !== undefined) requestedTimeouts.push(options.timeout);
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    };
    window.cancelIdleCallback = (id) => callbacks.delete(id);
  });

  await page.goto(baseUrl, { waitUntil: "load" });
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as typeof window & { __heroIdlePending: () => number }).__heroIdlePending(),
      ),
    )
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as typeof window & { __heroIdleTimeout: () => number | undefined }).__heroIdleTimeout(),
      ),
    )
    .toBe(1_500);
  await expect(page.locator("figure canvas")).toHaveCount(0);

  const scriptsBeforeIdle = new Set(scriptRequests);
  expect(await heroRuntimeScripts(request, scriptsBeforeIdle)).toEqual([]);

  await page.evaluate(() =>
    (window as typeof window & { __flushHeroIdle: (didTimeout?: boolean) => void }).__flushHeroIdle(true),
  );
  await expect(page.locator("figure canvas").or(page.getByText("ვიზუალი ვერ ჩაიტვირთა"))).toBeVisible({ timeout: 5_000 });

  const scriptsAfterTimeout = scriptRequests.filter((url) => !scriptsBeforeIdle.has(url));
  expect(await heroRuntimeScripts(request, scriptsAfterTimeout)).toHaveLength(1);
});

test("landing keeps timeout-driven hero readiness within five seconds of load", async ({ page }) => {
  await page.addInitScript(() => {
    const testWindow = window as typeof window & {
      __heroLoadAt?: number;
      __heroReadyAt?: number;
    };
    window.requestIdleCallback = (callback, options) =>
      window.setTimeout(
        () => callback({ didTimeout: true, timeRemaining: () => 0 }),
        options?.timeout ?? 0,
      );
    window.cancelIdleCallback = (id) => window.clearTimeout(id);
    window.addEventListener(
      "load",
      () => {
        testWindow.__heroLoadAt = performance.now();
      },
      { once: true },
    );
    new MutationObserver(() => {
      if (testWindow.__heroReadyAt !== undefined) return;
      if (document.querySelector("figure canvas") || document.body?.textContent?.includes("ვიზუალი ვერ ჩაიტვირთა")) {
        testWindow.__heroReadyAt = performance.now();
      }
    }).observe(document, { childList: true, subtree: true });
  });

  await page.goto(baseUrl, { waitUntil: "load" });
  await expect(page.locator("figure canvas")).toHaveCount(0);
  await expect(page.locator("figure canvas").or(page.getByText("ვიზუალი ვერ ჩაიტვირთა"))).toBeVisible({ timeout: 5_000 });
  const readiness = await page.evaluate(() => {
    const testWindow = window as typeof window & { __heroLoadAt?: number; __heroReadyAt?: number };
    return (testWindow.__heroReadyAt ?? Number.POSITIVE_INFINITY) - (testWindow.__heroLoadAt ?? 0);
  });
  expect(readiness).toBeGreaterThanOrEqual(1_500);
  expect(readiness).toBeLessThanOrEqual(5_000);
});

test("landing activates the hero after load when requestIdleCallback is unavailable", async ({ page, request }) => {
  const scriptRequests: Array<{ beforeLoad: boolean; url: string }> = [];
  let loadFired = false;
  page.on("request", (browserRequest) => {
    if (!new URL(browserRequest.url()).pathname.endsWith(".js")) return;
    scriptRequests.push({ beforeLoad: !loadFired, url: browserRequest.url() });
  });
  page.once("load", () => {
    loadFired = true;
  });
  await page.addInitScript(() => {
    Object.defineProperty(window, "requestIdleCallback", { configurable: true, value: undefined });
  });

  await page.goto(baseUrl, { waitUntil: "load" });
  await expect(page.locator("figure canvas").or(page.getByText("ვიზუალი ვერ ჩაიტვირთა"))).toBeVisible({ timeout: 5_000 });

  const matchingScripts = await heroRuntimeScripts(
    request,
    scriptRequests.map(({ url }) => url),
  );
  expect(matchingScripts).toHaveLength(1);
  expect(scriptRequests.find(({ url }) => url === matchingScripts[0])?.beforeLoad).toBe(false);
});

test("landing reduces mobile WebGL density while retaining desktop detail", async ({ browser }) => {
  for (const profile of [
    { name: "mobile", viewport: { width: 390, height: 844 }, expectedDots: 5_885, expectedPixelRatio: 1.25 },
    { name: "desktop", viewport: { width: 1440, height: 900 }, expectedDots: 10_656, expectedPixelRatio: 2 },
  ]) {
    const context = await browser.newContext({ viewport: profile.viewport, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.addInitScript(installHeroDrawInstrumentation);

    await page.goto(baseUrl);
    const canvas = page.locator("figure canvas");
    await expect(canvas.or(page.getByText("ვიზუალი ვერ ჩაიტვირთა")), profile.name).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            Math.max(...(window as typeof window & { __heroDrawCounts: number[] }).__heroDrawCounts),
          ),
        { message: `${profile.name} terrain draw count` },
      )
      .toBe(profile.expectedDots);
    const pixelRatio = await canvas.evaluate((element) => {
      const drawingSurface = element as HTMLCanvasElement;
      return drawingSurface.width / drawingSurface.getBoundingClientRect().width;
    });
    expect(pixelRatio, `${profile.name} canvas pixel ratio`).toBeCloseTo(profile.expectedPixelRatio, 1);
    await context.close();
  }
});

test("landing rebuilds one correctly sized hero across the mobile breakpoint", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.addInitScript(installHeroDrawInstrumentation);
  try {
    await page.goto(baseUrl);

    for (const profile of [
      { viewport: { width: 390, height: 844 }, expectedDots: 5_885, expectedPixelRatio: 1.25 },
      { viewport: { width: 768, height: 900 }, expectedDots: 10_656, expectedPixelRatio: 2 },
      { viewport: { width: 390, height: 844 }, expectedDots: 5_885, expectedPixelRatio: 1.25 },
    ]) {
      await page.setViewportSize(profile.viewport);
      const canvas = page.locator("figure canvas");
      await expect(canvas).toHaveCount(1, { timeout: 5_000 });
      await expect
        .poll(() =>
          page.evaluate(() =>
            (window as typeof window & { __heroTerrainDrawCount: number }).__heroTerrainDrawCount,
          ),
        )
        .toBe(profile.expectedDots);
      const pixelRatio = await canvas.evaluate((element) => {
        const drawingSurface = element as HTMLCanvasElement;
        return drawingSurface.width / drawingSurface.getBoundingClientRect().width;
      });
      expect(pixelRatio).toBeCloseTo(profile.expectedPixelRatio, 1);
    }
  } finally {
    await context.close();
  }
});

test("landing hero has no browser runtime warnings or errors", async ({ page }) => {
  const consoleIssues: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") consoleIssues.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(baseUrl);
  await expect(page.locator("figure canvas").or(page.getByText("ვიზუალი ვერ ჩაიტვირთა"))).toBeVisible({ timeout: 15_000 });
  await capture(page, "landing-runtime");

  expect(consoleIssues).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("landing hero remains usable with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(baseUrl);

  await expect(page.getByRole("img", { name: /საქართველოს ზუსტი რუკა ცოცხალ რელიეფად/ })).toBeVisible();
  await expect(page.locator("figure canvas").or(page.getByText("ვიზუალი ვერ ჩაიტვირთა"))).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { level: 1, name: "საქართველო ციფრებში" })).toBeVisible();
  const cta = page.getByTestId("hero-cta");
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute("href", "#data");
});

test("landing calls to action have visible keyboard focus", async ({ page }) => {
  await page.goto(baseUrl);

  await expectVisibleFocusOutline(page.getByTestId("hero-cta"));
  for (const testId of [
    "landing-dataset-expenditure",
    "landing-dataset-revenue",
    "landing-dataset-municipalities",
  ]) {
    await expectVisibleFocusOutline(page.getByTestId(testId).getByRole("link"));
  }
  await expectVisibleFocusOutline(
    page.getByTestId("landing-methodology").getByRole("link", { name: "მეთოდოლოგიის ნახვა →" }),
  );
});

test("landing keeps stats and dataset tables inside narrow viewports", async ({ page }) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(baseUrl);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByTestId("key-numbers").locator("[data-country-stat]")).toHaveCount(3);
    await expectNoPageOverflow(page);

    for (const testId of [
      "landing-dataset-expenditure",
      "landing-dataset-revenue",
      "landing-dataset-municipalities",
    ]) {
      await expectDatasetTableFits(page, testId);
      const section = page.getByTestId(testId);
      const positions = await section.locator(
        '[data-testid="landing-dataset-index"], [data-testid="landing-dataset-copy"], [data-testid="landing-dataset-data"]',
      ).evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().top));
      expect(positions[1]).toBeGreaterThanOrEqual(positions[0]!);
      expect(positions[2]).toBeGreaterThanOrEqual(positions[1]!);
    }

    if (width === 320) {
      await expect(page.getByTestId("population-unit")).toHaveCSS("display", "block");
    }
    await capture(page, `landing-${width}`);
  }
});

test("methodology is in the footer but never the landing header", async ({ page }) => {
  await page.goto(`${baseUrl}/`);
  await expect(page.getByTestId("landing-header").getByRole("link", { name: "მეთოდოლოგია" })).toHaveCount(0);
  await expect(page.getByTestId("site-footer").getByRole("link", { name: "მეთოდოლოგია" })).toHaveAttribute(
    "href",
    "/methodology",
  );
  await expect(page.getByTestId("landing-methodology")).toBeVisible();
  await expect(page.getByTestId("methodology-promo")).toHaveCount(0);
});

test("footer links keep non-overlapping 24px mobile targets and keyboard focus", async ({ page }) => {
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 767, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(baseUrl);

    const links = page.getByTestId("site-footer").getByRole("link");
    expect(await links.count()).toBe(6);
    for (const link of await links.all()) {
      await expectMinimumTarget(link);
    }
    await expectKeyboardFocusOrder(page, links);
    await expectNonOverlappingTargets(links);
    await expectNoPageOverflow(page);
  }
});

test("shared brand identity uses the full desktop lockup and compact mobile lockup", async ({ page, request }) => {
  for (const viewport of [
    { width: 1440, height: 900, asset: "fiscal-logo-horizontal.svg", minimumWidth: 280 },
    { width: 900, height: 900, asset: "fiscal-logo-horizontal.svg", minimumWidth: 280 },
    { width: 768, height: 900, asset: "fiscal-logo-horizontal.svg", minimumWidth: 280 },
    { width: 767, height: 900, asset: "fiscal-logo-compact.svg", minimumWidth: 118 },
    { width: 390, height: 844, asset: "fiscal-logo-compact.svg", minimumWidth: 118 },
  ] as const) {
    await page.setViewportSize(viewport);
    await page.goto(baseUrl);
    const logo = page.getByTestId("site-header-logo");
    await expect(logo).toBeVisible();
    const currentSrc = await logo.evaluate((image: HTMLImageElement) => image.currentSrc);
    expect(currentSrc).toContain(viewport.asset);
    const assetResponse = await request.get(currentSrc);
    expect(assetResponse.status()).toBe(200);
    expect(assetResponse.headers()["content-type"]).toMatch(/^image\/svg\+xml/);
    await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    expect((await logo.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(viewport.minimumWidth);
    await expect(page.getByTestId("landing-header").getByRole("link", { name: "Fiscal.ge — მთავარი", exact: true })).toHaveCount(1);
    await expect(logo).toHaveAttribute("alt", "");
  }
});

test("active public-header underline touches the header rule across the logo breakpoint", async ({ page }) => {
  for (const viewport of [
    { width: 768, height: 900 },
    { width: 767, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(baseUrl);
    const activeLink = page.getByTestId("landing-header").getByRole("link", { name: "მთავარი", exact: true });
    const geometry = await activeLink.evaluate((link) => {
      const header = link.closest("header")!;
      const linkBox = link.getBoundingClientRect();
      const headerBox = header.getBoundingClientRect();
      const headerBorderWidth = Number.parseFloat(getComputedStyle(header).borderBottomWidth);
      return {
        headerRuleTop: headerBox.bottom - headerBorderWidth,
        underlineBottom: linkBox.bottom,
      };
    });
    expect(
      Math.abs(geometry.headerRuleTop - geometry.underlineBottom),
      `${viewport.width}px underline-to-rule gap`,
    ).toBeLessThanOrEqual(0.5);
  }
});

test("shared footer uses the compact logo without changing its trust content", async ({ page }) => {
  await page.goto(baseUrl);
  const footer = page.getByTestId("site-footer");
  await expect(footer.getByTestId("site-footer-logo")).toHaveAttribute("src", "/brand/fiscal-logo-compact.svg");
  await expect(footer.getByRole("link", { name: "Fiscal.ge — მთავარი", exact: true })).toHaveCount(1);
  await expect(footer).toContainText("info@fiscal.ge");
  await expect(footer).toContainText("CC BY 4.0");
});

for (const width of [768, 1100]) {
  test(`hero leaves room for enlarged text at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(baseUrl);
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await expect(page.locator("figure canvas")).toBeVisible({ timeout: 15_000 });
    const initialCanvasHeight = (await page.locator("figure canvas").boundingBox())!.height;

    // Text-only enlargement keeps the viewport and map scale unchanged.
    await page.locator("[data-hero-copy] p, [data-hero-copy] h1, [data-hero-copy] a").evaluateAll((elements) => {
      for (const element of elements) {
        (element as HTMLElement).style.fontSize = `${Number.parseFloat(getComputedStyle(element).fontSize) * 2}px`;
      }
    });
    await page.setViewportSize({ width: width + 1, height: 900 });
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(async () => (await page.locator("figure canvas").boundingBox())!.height).toBeGreaterThan(initialCanvasHeight);
    const copy = await page.locator("[data-hero-copy]").boundingBox();
    const stats = await page.getByTestId("key-numbers").boundingBox();
    expect(copy).not.toBeNull();
    expect(stats).not.toBeNull();
    const figure = await page.locator("figure").boundingBox();
    const canvas = await page.locator("figure canvas").boundingBox();
    expect(canvas!.height).toBeLessThanOrEqual(figure!.height + 1);
    expect(stats!.y).toBeGreaterThanOrEqual(copy!.y + copy!.height + 24);

    await page.locator("[data-hero-copy] p, [data-hero-copy] h1, [data-hero-copy] a").evaluateAll((elements) => {
      for (const element of elements) (element as HTMLElement).style.removeProperty("font-size");
    });
    await expect.poll(async () => {
      const frame = await page.locator("figure").boundingBox();
      const canvas = await page.locator("figure canvas").boundingBox();
      return canvas!.height - frame!.height;
    }).toBeLessThanOrEqual(1);
  });
}

for (const viewport of [
  { width: 320, height: 844 },
  { width: 390, height: 844 },
  { width: 767, height: 900 },
  { width: 768, height: 900 },
  { width: 1099, height: 900 },
  { width: 1100, height: 900 },
  { width: 1440, height: 640 },
  { width: 1440, height: 900 },
  { width: 1920, height: 900 },
  { width: 1920, height: 1200 },
  { width: 2560, height: 900 },
  { width: 4000, height: 900 },
]) {
  test(`hero initialization preserves reserved space at ${viewport.width}px by ${viewport.height}px`, async ({ browser, page }) => {
    const initialContext = await browser.newContext({ javaScriptEnabled: false, viewport });
    try {
      const initialPage = await initialContext.newPage();
      await initialPage.goto(baseUrl);
      await initialPage.evaluate(() => document.fonts.ready.then(() => undefined));
      const initialFigure = await initialPage.locator("figure").boundingBox();
      const initialStats = await initialPage.getByTestId("key-numbers").boundingBox();
      expect(initialFigure).not.toBeNull();
      expect(initialStats).not.toBeNull();

      await page.setViewportSize(viewport);
      await page.goto(baseUrl);
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      await expect(page.locator("figure canvas")).toBeVisible({ timeout: 15_000 });
      await expect.poll(async () => {
        const figure = await page.locator("figure").boundingBox();
        const stats = await page.getByTestId("key-numbers").boundingBox();
        if (!figure || !stats) return Number.POSITIVE_INFINITY;
        return Math.max(
          Math.abs(figure.height - initialFigure!.height),
          Math.abs(stats.y - initialStats!.y),
        );
      }).toBeLessThanOrEqual(1);
      const figure = await page.locator("figure").boundingBox();
      const canvas = await page.locator("figure canvas").boundingBox();
      expect(figure).not.toBeNull();
      expect(canvas).not.toBeNull();
      expect(canvas!.height).toBeLessThanOrEqual(figure!.height + 1);
      expect(figure!.height - canvas!.height).toBeLessThanOrEqual(10);
      await expectNoPageOverflow(page);
    } finally {
      await initialContext.close();
    }
  });
}
