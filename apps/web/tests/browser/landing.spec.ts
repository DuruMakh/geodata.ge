import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { computedCssColorAlpha } from "./focus-outline";

// Landing page (GeoData Site v2 design): structure, live data blocks, and the
// paths into the explorer. The hero is a static image below 768px and WebGL at
// wider sizes; tests assert the matching visual mounts rather than pixel content.

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";
const heroRuntimeMarkers = ["WebGLRenderer", "hero scene init failed"] as const;

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
    __heroFirstTerrainDrawAt?: number;
    __heroTerrainDrawCount: number;
  };
  testWindow.__heroDrawCounts = counts;
  testWindow.__heroTerrainDrawCount = 0;
  type DrawArraysOwner = { drawArrays: (mode: number, first: number, count: number) => void };
  const wrap = (prototype: DrawArraysOwner) => {
    const original = prototype.drawArrays;
    prototype.drawArrays = function (this: DrawArraysOwner, mode, first, count) {
      counts.push(count);
      if (count > 1_000) {
        testWindow.__heroFirstTerrainDrawAt ??= performance.now();
        testWindow.__heroTerrainDrawCount = count;
      }
      original.call(this, mode, first, count);
    };
  };
  wrap(WebGLRenderingContext.prototype);
  if (typeof WebGL2RenderingContext !== "undefined") wrap(WebGL2RenderingContext.prototype);
}

// Below 768px the hero loader decides on mount and schedules nothing; from 768px
// it would wait for one idle period after load. Once the page has hydrated and two
// idle periods have passed, a scene that was going to load has requested its chunk.
async function pastHeroDecision(page: Page) {
  await expect
    .poll(() =>
      page.getByTestId("mobile-hero-static").evaluate((element) => Object.keys(element).some((key) => key.startsWith("__reactFiber"))),
    )
    .toBe(true);
  await page.evaluate(() => new Promise((resolve) => requestIdleCallback(() => requestIdleCallback(resolve))));
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

// The copy each language must render. Figures are not listed: they come from the
// served data, so the test checks their shape and that they agree with each other.
const LANDING_COPY = {
  ka: {
    prefix: "",
    title: "საქართველოს საჯარო ფინანსებისა და ეკონომიკის მონაცემები | Fiscal.ge",
    description:
      "საქართველოს ბიუჯეტი, ვალი, მშპ, ინფლაცია, უმუშევრობა, ხელფასები, ვაჭრობა და მოსახლეობა — გადამოწმებული ოფიციალური მონაცემები, წყაროები და Excel ფაილები.",
    heading: "საქართველო ციფრებში",
    portal: "საქართველოს მონაცემების პორტალი",
    cta: "გაეცანი მონაცემებს",
    heroFallback: "ვიზუალი ვერ ჩაიტვირთა",
    population: "3.9",
    populationCaption: "2026 წლის 1 იანვარი · საქსტატი",
    area: "69.7",
    sections: [
      "როგორ იხარჯება საქართველოს ბიუჯეტი",
      "როგორ ფინანსდება საქართველოს ბიუჯეტი",
      "როგორ ხარჯავენ ბიუჯეტს საქართველოს მუნიციპალიტეტები",
      "რამდენია საქართველოს მთავრობის ვალი",
      "რამდენია საქართველოს ბიუჯეტის დეფიციტი",
      "მეთოდოლოგია და პირველწყაროები",
    ],
    caption: (heading: string, year: string) => `${heading} — ${year} წლის მონაცემები`,
    amount: /^\d+\.\d მლრდ ₾$/,
    domesticDebt: "საშინაო ვალი",
    externalDebt: "საგარეო ვალი",
    debtLink: "ვალის მონაცემები →",
    deficitShare: "დეფიციტი მშპ-სთან მიმართებით",
    actualData: "ფაქტობრივი მონაცემი",
    deficitLink: "დეფიციტის მონაცემები →",
    municipalColumn: "უდიდესი მუნიციპალური ბიუჯეტები",
    methodologyLink: "მეთოდოლოგიის ნახვა →",
    methodology: "მეთოდოლოგია",
  },
  en: {
    prefix: "/en",
    title: "Georgia’s public finance and economy data | Fiscal.ge",
    description:
      "Georgia’s budget, debt, GDP, inflation, unemployment, wages, trade and population — reviewed official data with sources and Excel downloads.",
    heading: "Georgia in numbers",
    portal: "Georgia’s data portal",
    cta: "Explore the data",
    heroFallback: "The visual could not load — data is available in the explorer",
    population: "3.9",
    populationCaption: "1 January 2026 · Geostat",
    area: "69.7",
    sections: [
      "How Georgia’s budget is spent",
      "How Georgia’s budget is financed",
      "How Georgia’s municipalities spend their budgets",
      "How much Georgia’s government owes",
      "How large is Georgia’s budget deficit?",
      "Methodology and original sources",
    ],
    caption: (heading: string, year: string) => `${heading} — data for ${year}`,
    amount: /^\d+\.\d bn GEL$/,
    domesticDebt: "Domestic debt",
    externalDebt: "External debt",
    debtLink: "Debt data →",
    deficitShare: "Deficit as a share of GDP",
    actualData: "Actual data",
    deficitLink: "Deficit data →",
    municipalColumn: "Largest municipal budgets",
    methodologyLink: "View methodology →",
    methodology: "Methodology",
  },
} as const;

const SIGNED_PERCENT = /^[−+]?\d+\.\d%$/;

for (const [locale, copy] of Object.entries(LANDING_COPY)) {
  test(`landing renders the approved latest-year data composition: ${locale}`, async ({ page }) => {
    const href = (path: string) => `${copy.prefix}${path}`;
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`${baseUrl}${copy.prefix}/`);

    await expect(page).toHaveTitle(copy.title);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", copy.description);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.heading);
    await expect(page.getByText(copy.portal, { exact: true })).toBeVisible();
    await expect(page.getByTestId("hero-cta")).toHaveText(copy.cta);
    await expect(page.getByTestId("hero-cta")).toHaveAttribute("href", href("/explorer"));
    await expect(page.locator("figure canvas").or(page.getByText(copy.heroFallback))).toBeVisible({ timeout: 15_000 });

    // Population and area are maintained by hand; the economic size is the latest
    // nominal GDP, the same figure and year as the Economy link in the dataset row.
    const figures = page.getByTestId("key-numbers");
    await expect(figures).toContainText(copy.population);
    await expect(figures).toContainText(copy.populationCaption);
    await expect(figures).toContainText(copy.area);
    const economyLink = (await page.getByTestId("landing-datasets").locator(`a[href="${href("/explorer/economy")}"]`).textContent()) ?? "";
    const [, gdpYear, gdpValue] = economyLink.match(/· (\d{4}): ([\d.,]+)/) ?? [];
    expect(gdpYear, economyLink).toBeDefined();
    const gdpFigure = figures.locator("[data-country-stat]").nth(2);
    expect((await gdpFigure.locator(":scope > div").nth(1).textContent())?.trim().split(/\s/)[0]).toBe(gdpValue);
    await expect(gdpFigure).toContainText(gdpYear!);
    await expectNoPageOverflow(page);

    expect(await page.locator("#data h2").allTextContents()).toEqual(copy.sections);
    const landingData = page.getByTestId("landing-data");
    const expenditureSection = page.getByTestId("landing-dataset-expenditure");
    if (locale === "ka") {
      await expect(page.getByText("საჯარო ფინანსების წლიური", { exact: true })).toHaveCount(0);
      await expect(page.getByText(/^ბოლო ხელმისაწვდომი წელი · \d{4}$/)).toHaveCount(0);
    }
    await expect(landingData.locator(':scope > [data-testid="landing-dataset-expenditure"]')).toHaveCount(1);
    expect(
      await landingData.locator(":scope > *").evaluateAll((elements) => elements.map((element) => element.getAttribute("data-testid"))),
    ).toEqual([
      "landing-dataset-expenditure",
      "landing-dataset-revenue",
      "landing-dataset-municipalities",
      "landing-debt",
      "landing-deficit",
      "landing-methodology",
    ]);
    await expect(landingData).toHaveCSS("border-top-width", "0px");
    await expect(expenditureSection).toHaveCSS("border-top-width", "0px");

    for (const [index, [testId, path]] of [
      ["landing-dataset-expenditure", "/explorer/expenditure"],
      ["landing-dataset-revenue", "/explorer/revenue"],
      ["landing-dataset-municipalities", "/explorer/municipalities"],
    ].entries()) {
      const section = page.getByTestId(testId);
      await expect(section.getByTestId("landing-dataset-total")).toBeVisible();
      await expectDatasetTableFits(page, testId);
      await expect(section.locator("tbody tr").first().getByRole("rowheader")).not.toBeEmpty();
      await expect(section.locator("tbody tr").first().getByRole("cell")).toHaveCount(2);
      // The table's year column, its caption and the total all name the section's latest year.
      const latestYear = (await section.getByTestId("landing-dataset-total").locator("strong").textContent())!;
      expect(latestYear).toMatch(/^\d{4}$/);
      await expect(section.locator("thead th").nth(1)).toHaveText(latestYear);
      const caption = copy.caption(copy.sections[index]!, latestYear);
      await expect(section.locator("table caption")).toHaveText(caption);
      await expect(section.getByRole("table", { name: caption })).toHaveCount(1);
      await expect(section.getByRole("link")).toHaveAttribute("href", href(path));
    }

    // Debt: the total and both parts are amounts in billion lari for one latest actual year.
    const debtSection = page.getByTestId("landing-debt");
    await expect(debtSection.getByText(copy.amount)).toHaveCount(3);
    await expect(debtSection.locator("strong")).toHaveText(/^\d{4}$/);
    await expect(debtSection).toContainText(copy.domesticDebt);
    await expect(debtSection).toContainText(copy.externalDebt);
    await expect(debtSection).toContainText(copy.actualData);
    await expect(debtSection.getByRole("link", { name: copy.debtLink })).toHaveAttribute("href", href("/explorer/debt"));

    // Deficit: three consecutive actual years, the last of them the headline year and value.
    const deficitSection = page.getByTestId("landing-deficit");
    await expect(deficitSection).toContainText(copy.deficitShare);
    await expect(deficitSection).toContainText(copy.actualData);
    const headline = deficitSection.getByText(SIGNED_PERCENT).first();
    const headlineYear = deficitSection.locator("strong").first();
    await expect(headlineYear).toHaveText(/^\d{4}$/);
    const history = deficitSection.getByTestId("landing-deficit-history").locator("li");
    await expect(history).toHaveCount(3);
    const latest = Number(await headlineYear.textContent());
    for (let index = 0; index < 3; index += 1) {
      await expect(history.nth(index).locator("span")).toHaveText(String(latest - 2 + index));
      await expect(history.nth(index).locator("strong")).toHaveText(SIGNED_PERCENT);
    }
    await expect(history.nth(2).locator("strong")).toHaveText((await headline.textContent())!);
    if (locale === "ka") {
      await expect(deficitSection.getByText("როგორ წავიკითხოთ", { exact: true })).toHaveCount(0);
      await expect(deficitSection.getByText("ნომინალური ბალანსი", { exact: true })).toHaveCount(0);
    }
    await expect(deficitSection.getByRole("link", { name: copy.deficitLink })).toHaveAttribute("href", href("/explorer/deficit"));
    await expect(page.getByText(copy.municipalColumn, { exact: true })).toBeVisible();
    await expect(page.getByTestId("landing-methodology").getByRole("link", { name: copy.methodologyLink })).toHaveAttribute("href", href("/methodology"));

    await expect(page.getByTestId("landing-data").locator("svg, canvas")).toHaveCount(0);

    const footer = page.getByTestId("landing-footer");
    await expect(footer.getByRole("link", { name: "info@fiscal.ge" })).toHaveAttribute("href", "mailto:info@fiscal.ge");
    await expect(footer).toContainText("CC BY 4.0");

    // Methodology stays out of the landing header and in the footer.
    await expect(page.getByTestId("landing-header").getByRole("link", { name: copy.methodology })).toHaveCount(0);
    await expect(page.getByTestId("site-footer").getByRole("link", { name: copy.methodology })).toHaveAttribute(
      "href",
      href("/methodology"),
    );
  });
}

test("landing data and methodology links use real destinations", async ({ page }) => {
  await page.goto(baseUrl);
  const dataNav = page.getByTestId("landing-header").getByRole("link", { name: "მონაცემები", exact: true });
  await expect(dataNav).toHaveAttribute("href", "/explorer");
  await expect(page.getByTestId("landing-header").getByRole("link", { name: "ექსპლორერი", exact: true })).toHaveCount(0);
  await page.getByTestId("hero-cta").click();
  await expect(page).toHaveURL(/\/explorer$/);
  await expect(page.getByTestId("explorer-shell")).toBeVisible();

  await page.goto(baseUrl);
  await page.getByTestId("landing-dataset-revenue").getByRole("link").click();
  await expect(page).toHaveURL(/\/explorer\/revenue/);
  await expect(page.getByTestId("explorer-shell")).toBeVisible();

  await page.goto(`${baseUrl}/en/`);
  await page.getByTestId("hero-cta").click();
  await expect(page).toHaveURL(`${baseUrl}/en/explorer`);
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
  expect(new URL(fontResponses[0]!.url).pathname).toMatch(/\/EurostileGEOMt-Demi\.[^/]+\.woff2$/);

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

test("landing keeps mobile header and statistic geometry stable while fonts load", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.route(/\.(?:woff2|ttf)(?:\?|$)/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const response = await route.fetch();
    await route.fulfill({ response });
  });

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  const nav = page.getByTestId("landing-header").getByRole("button", { name: "მენიუ" });
  const logo = page.getByTestId("site-header-logo").locator("..");
  const heading = page.getByRole("heading", { level: 1, name: "საქართველო ციფრებში" });
  const statisticValues = page.locator("[data-country-stat] > div:nth-child(2)");
  const before = {
    nav: await nav.boundingBox(),
    logo: await logo.boundingBox(),
    heading: await heading.boundingBox(),
    statisticValues: await Promise.all((await statisticValues.all()).map((value) => value.boundingBox())),
  };

  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const after = {
    nav: await nav.boundingBox(),
    logo: await logo.boundingBox(),
    heading: await heading.boundingBox(),
    statisticValues: await Promise.all((await statisticValues.all()).map((value) => value.boundingBox())),
  };

  for (const key of ["x", "y", "width", "height"] as const) {
    expect(after.nav?.[key], `menu button ${key}`).toBeCloseTo(before.nav?.[key] ?? Number.NaN, 0);
    expect(after.logo?.[key], `logo ${key}`).toBeCloseTo(before.logo?.[key] ?? Number.NaN, 0);
    expect(after.heading?.[key], `hero heading ${key}`).toBeCloseTo(before.heading?.[key] ?? Number.NaN, 0);
  }
  for (const geometry of [before, after]) {
    expect(geometry.nav!.y + geometry.nav!.height / 2).toBeCloseTo(
      geometry.logo!.y + geometry.logo!.height / 2,
      0,
    );
    expect(geometry.nav!.x).toBeGreaterThan(geometry.logo!.x + geometry.logo!.width);
  }
  expect(after.statisticValues).toHaveLength(3);
  for (const [index, box] of after.statisticValues.entries()) {
    for (const key of ["x", "y", "width", "height"] as const) {
      expect(box?.[key], `statistic ${index + 1} ${key}`).toBeCloseTo(
        before.statisticValues[index]?.[key] ?? Number.NaN,
        0,
      );
    }
  }
  const statisticHeights = after.statisticValues.map((box) => box?.height ?? Number.NaN);
  expect(Math.max(...statisticHeights) - Math.min(...statisticHeights)).toBeLessThanOrEqual(1);
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
  await page.addInitScript(installHeroDrawInstrumentation);
  await page.addInitScript(() => {
    const testWindow = window as typeof window & {
      __heroFallbackAt?: number;
      __heroLoadAt?: number;
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
      if (testWindow.__heroFallbackAt !== undefined) return;
      // The translated fallback also travels in hidden page data; readiness
      // must observe the rendered figure rather than serialized script text.
      if (document.querySelector<HTMLElement>(".landing-hero-frame")?.innerText.includes("ვიზუალი ვერ ჩაიტვირთა")) {
        testWindow.__heroFallbackAt = performance.now();
      }
    }).observe(document, { childList: true, subtree: true });
  });

  await page.goto(baseUrl, { waitUntil: "load" });
  await expect(page.locator("figure canvas")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const testWindow = window as typeof window & {
          __heroFallbackAt?: number;
          __heroFirstTerrainDrawAt?: number;
          __heroLoadAt?: number;
        };
        const readyAt = testWindow.__heroFirstTerrainDrawAt ?? testWindow.__heroFallbackAt;
        return readyAt === undefined ? Number.POSITIVE_INFINITY : readyAt - (testWindow.__heroLoadAt ?? 0);
      }),
    )
    .toBeLessThanOrEqual(5_000);
  const readiness = await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __heroFallbackAt?: number;
      __heroFirstTerrainDrawAt?: number;
      __heroLoadAt?: number;
    };
    return (
      (testWindow.__heroFirstTerrainDrawAt ?? testWindow.__heroFallbackAt ?? Number.POSITIVE_INFINITY) -
      (testWindow.__heroLoadAt ?? 0)
    );
  });
  expect(readiness).toBeGreaterThanOrEqual(1_500);
  await expect(page.locator("figure canvas").or(page.getByText("ვიზუალი ვერ ჩაიტვირთა"))).toBeVisible();
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

// The dense desktop grid (dot step 8.6) draws 10,656 terrain points; the phone preset (11.5) draws far fewer.
const DESKTOP_TERRAIN_FLOOR = 8_000;

test("landing serves a static mobile hero without loading WebGL and retains desktop detail", async ({ browser, request }) => {
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  try {
    const mobilePage = await mobileContext.newPage();
    const mobileScripts: string[] = [];
    mobilePage.on("request", (browserRequest) => {
      if (new URL(browserRequest.url()).pathname.endsWith(".js")) mobileScripts.push(browserRequest.url());
    });
    await mobilePage.addInitScript(installHeroDrawInstrumentation);
    await mobilePage.goto(baseUrl);
    const mobileStatic = mobilePage.getByTestId("mobile-hero-static");
    const mobileStaticImage = mobileStatic.locator("img");
    await expect(mobileStatic).toBeVisible();
    await expect(mobileStaticImage).toHaveJSProperty("complete", true);
    expect(await mobileStaticImage.evaluate((image) => (image as HTMLImageElement).currentSrc)).toMatch(
      /\/landing\/hero-relief-mobile-390\.webp$/,
    );
    expect(await mobileStaticImage.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBe(780);
    await pastHeroDecision(mobilePage);
    await expect(mobilePage.locator("figure canvas")).toHaveCount(0);
    expect(await heroRuntimeScripts(request, mobileScripts)).toEqual([]);

    // Crossing the breakpoint live mounts exactly one desktop canvas and hides the static hero; crossing back unmounts it.
    const canvas = mobilePage.locator("figure canvas");
    await mobilePage.setViewportSize({ width: 768, height: 900 });
    await expect(mobileStatic).toBeHidden();
    await expect(canvas).toHaveCount(1, { timeout: 5_000 });
    await expect
      .poll(() =>
        mobilePage.evaluate(() =>
          (window as typeof window & { __heroTerrainDrawCount: number }).__heroTerrainDrawCount,
        ),
      )
      .toBeGreaterThan(DESKTOP_TERRAIN_FLOOR);
    // U01-06: at tablet width the Kazbek label landed on the eyebrow line; it shows from 1100px.
    await expect(mobilePage.locator('[data-gid="mkin"]')).toHaveCSS("display", "none");
    await mobilePage.setViewportSize({ width: 390, height: 844 });
    await expect(mobileStatic).toBeVisible();
    await expect(canvas).toHaveCount(0);
  } finally {
    await mobileContext.close();
  }

  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  try {
    const desktopPage = await desktopContext.newPage();
    const desktopImages: string[] = [];
    desktopPage.on("request", (browserRequest) => {
      if (new URL(browserRequest.url()).pathname.endsWith(".webp")) desktopImages.push(browserRequest.url());
    });
    await desktopPage.addInitScript(installHeroDrawInstrumentation);
    await desktopPage.goto(baseUrl);
    await expect(desktopPage.getByTestId("mobile-hero-static")).toBeHidden();
    expect(desktopImages).toEqual([]);
    const canvas = desktopPage.locator("figure canvas");
    await expect(canvas.or(desktopPage.getByText("ვიზუალი ვერ ჩაიტვირთა"))).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(() =>
        desktopPage.evaluate(() =>
          Math.max(...(window as typeof window & { __heroDrawCounts: number[] }).__heroDrawCounts),
        ),
      )
      .toBeGreaterThan(DESKTOP_TERRAIN_FLOOR);
    const pixelRatio = await canvas.evaluate((element) => {
      const drawingSurface = element as HTMLCanvasElement;
      return drawingSurface.width / drawingSurface.getBoundingClientRect().width;
    });
    expect(pixelRatio).toBeCloseTo(2, 1);
    await expect(desktopPage.locator('[data-gid="mkin"]')).toHaveCSS("display", "block");
  } finally {
    await desktopContext.close();
  }
});

test("landing hero has no browser runtime warnings or errors", async ({ page }) => {
  const consoleIssues: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") consoleIssues.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.addInitScript(installHeroDrawInstrumentation);
  await page.goto(baseUrl);
  const canvas = page.locator("figure canvas");
  await expect(canvas.or(page.getByText("ვიზუალი ვერ ჩაიტვირთა"))).toBeVisible({ timeout: 15_000 });
  // The scene has drawn its terrain, so start-up and first-frame warnings are already logged.
  if (await canvas.isVisible()) {
    await expect
      .poll(() => page.evaluate(() => (window as typeof window & { __heroTerrainDrawCount: number }).__heroTerrainDrawCount))
      .toBeGreaterThan(0);
  }

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
  await expect(cta).toHaveAttribute("href", "/explorer");
});

test("landing calls to action have visible keyboard focus", async ({ page }) => {
  await page.goto(baseUrl);

  await expectVisibleFocusOutline(page.getByTestId("hero-cta"));
  for (const testId of [
    "landing-dataset-expenditure",
    "landing-dataset-revenue",
    "landing-dataset-municipalities",
    "landing-debt",
    "landing-deficit",
  ]) {
    await expectVisibleFocusOutline(page.getByTestId(testId).getByRole("link"));
  }
  await expectVisibleFocusOutline(
    page.getByTestId("landing-methodology").getByRole("link", { name: "მეთოდოლოგიის ნახვა →" }),
  );
});

test("landing keeps stats and dataset tables inside narrow viewports", async ({ page }) => {
  // 768 and 820: tablet portrait, where the five dataset columns are narrowest (U01-23).
  for (const width of [390, 320, 768, 820]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(baseUrl);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByTestId("key-numbers").locator("[data-country-stat]")).toHaveCount(3);
    await expectNoPageOverflow(page);
    expect((await page.getByTestId("hero-cta").boundingBox())?.height ?? 0, `hero CTA at ${width}px`).toBeGreaterThanOrEqual(44);
    // Nothing in a dataset link (a long value such as "25.9 მლრდ აშშ დოლარი") runs past the link's own box.
    const overruns = await page.getByTestId("landing-datasets").getByRole("link").evaluateAll((links) =>
      links.flatMap((link) => {
        const box = link.getBoundingClientRect();
        return [...link.querySelectorAll("*")]
          .map((element) => element.getBoundingClientRect())
          .filter((inner) => inner.right > box.right + 0.5 || inner.left < box.left - 0.5)
          .map((inner) => `${link.textContent?.trim()}: ${Math.round(inner.right - box.right)}px`);
      }),
    );
    expect(overruns, `dataset links at ${width}px`).toEqual([]);

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

    for (const testId of ["landing-debt", "landing-deficit"]) {
      const section = page.getByTestId(testId);
      await expect(section).toBeVisible();
      await expect(section.getByRole("link")).toBeVisible();
    }

    if (width === 320) {
      await expect(page.getByTestId("population-unit")).toHaveCSS("display", "block");
      // The debt total and its two parts, whatever the latest figures are.
      const amounts = page.getByTestId("landing-debt").getByText(LANDING_COPY.ka.amount);
      await expect(amounts).toHaveCount(3);
      for (const value of await amounts.all()) {
        await expect(value).toBeVisible();
        expect(
          await value.evaluate((element) => element.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(element).lineHeight)),
          `${await value.textContent()} should stay on one line`,
        ).toBeLessThan(1.2);
      }
    }
  }
});

test("landing methodology keeps reading order and stays inside a 390px phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/`);
  const methodology = page.getByTestId("landing-methodology");
  const methodologyTitle = methodology.getByRole("heading", { level: 2 });
  const methodologyList = methodology.locator("ol");
  const footer = page.getByTestId("site-footer");
  await expect(methodology).toBeVisible();
  await expect(methodologyTitle).toBeVisible();
  await expect(methodologyList).toBeVisible();
  await expect(footer).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
  const geometry = await page.evaluate(() => {
    const section = document.querySelector<HTMLElement>('[data-testid="landing-methodology"]');
    const title = section?.querySelector<HTMLElement>("h2");
    const list = section?.querySelector<HTMLOListElement>("ol");
    const footerElement = document.querySelector<HTMLElement>('[data-testid="site-footer"]');
    if (!section || !title || !list || !footerElement) return null;

    const box = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };

    return {
      methodology: box(section),
      title: box(title),
      list: box(list),
      footer: box(footerElement),
      overflow: {
        body: document.body.scrollWidth,
        viewport: document.documentElement.clientWidth,
      },
    };
  });
  expect(geometry).not.toBeNull();
  if (!geometry) throw new Error("Landing methodology geometry was not found");
  expect(geometry.methodology.x).toBeGreaterThanOrEqual(0);
  expect(geometry.methodology.x + geometry.methodology.width).toBeLessThanOrEqual(390);
  expect(geometry.title.x).toBeGreaterThanOrEqual(0);
  expect(geometry.title.x + geometry.title.width).toBeLessThanOrEqual(390);
  expect(geometry.list.x).toBeGreaterThanOrEqual(0);
  expect(geometry.list.x + geometry.list.width).toBeLessThanOrEqual(390);
  expect(geometry.list.y).toBeGreaterThanOrEqual(geometry.title.y + geometry.title.height);
  expect(geometry.footer.y).toBeGreaterThanOrEqual(geometry.methodology.y + geometry.methodology.height);
  expect(geometry.overflow).toEqual({ body: 390, viewport: 390 });
});

test("landing methodology keeps its introduction and link with the left heading on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${baseUrl}/`);

  const methodology = page.getByTestId("landing-methodology");
  const copy = methodology.getByTestId("landing-methodology-copy");
  const intro = methodology.getByTestId("landing-methodology-intro");
  const link = methodology.getByTestId("landing-methodology-link");
  const list = methodology.locator("ol");
  await expect(copy).toBeVisible();
  await expect(intro).toBeVisible();
  await expect(link).toBeVisible();
  await expect(list).toBeVisible();

  const positions = await page.evaluate(() => {
    const section = document.querySelector<HTMLElement>('[data-testid="landing-methodology"]')!;
    const box = (selector: string) => {
      const rect = section.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top };
    };
    return {
      copy: box('[data-testid="landing-methodology-copy"]'),
      intro: box('[data-testid="landing-methodology-intro"]'),
      link: box('[data-testid="landing-methodology-link"]'),
      list: box("ol"),
    };
  });

  expect(positions.intro.left).toBeGreaterThanOrEqual(positions.copy.left);
  expect(positions.intro.right).toBeLessThanOrEqual(positions.copy.right);
  expect(positions.link.left).toBeGreaterThanOrEqual(positions.copy.left);
  expect(positions.link.right).toBeLessThanOrEqual(positions.copy.right);
  expect(positions.list.left).toBeGreaterThan(positions.copy.right);
  expect(positions.list.top).toBeLessThanOrEqual(positions.intro.top);
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
    // The production connection is discoverable from every site footer.
    // Logo, the seventeen dataset hubs, methodology, AI-კავშირი, მიზანი and the address.
    await expect(links).toHaveCount(22);
    await expect(page.getByTestId("site-footer").getByRole("link", { name: "AI-კავშირი", exact: true })).toHaveAttribute("href", "/connect");
    for (const link of await links.all()) {
      await expectMinimumTarget(link);
    }
    await expectKeyboardFocusOrder(page, links);
    await expectNonOverlappingTargets(links);
    await expectNoPageOverflow(page);
  }

  // The shared footer carries exactly one connection link on other pages too.
  await page.goto(`${baseUrl}/about`);
  await expect(page.locator('footer a[href="/connect"]')).toHaveCount(1);
});

test("active public-header underline sits directly beneath its label across the logo breakpoint", async ({ page }) => {
  for (const viewport of [
    { width: 768, height: 900 },
    { width: 767, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(baseUrl);
    await page.getByTestId("landing-header").getByRole("button", { name: "მენიუ" }).click();
    const activeLink = page.getByTestId("landing-header").getByRole("link", { name: "მთავარი", exact: true });
    const decoration = await activeLink.evaluate((link) => {
      const style = getComputedStyle(link);
      const header = link.closest("header")!;
      const dataSection = document.querySelector('[data-testid="landing-data"]')!;
      return {
        line: style.textDecorationLine,
        color: style.textDecorationColor,
        thickness: style.textDecorationThickness,
        offset: style.textUnderlineOffset,
        headerBorder: getComputedStyle(header).borderBottomWidth,
        dataBorder: getComputedStyle(dataSection).borderTopWidth,
      };
    });
    expect(decoration.line, `${viewport.width}px active label decoration`).toContain("underline");
    expect(decoration.color).toBe("rgb(179, 64, 42)");
    expect(decoration.thickness).toBe("2px");
    expect(decoration.offset).toBe("5px");
    expect(decoration.headerBorder).toBe("0px");
    expect(decoration.dataBorder).toBe("0px");
  }
});

async function expectRoomForEnlargedText(page: Page, width: number) {
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
}

for (const viewport of [
  { width: 320, height: 844 },
  { width: 767, height: 900 },
  { width: 768, height: 900 },
  { width: 1099, height: 900 },
  { width: 1100, height: 900 },
  { width: 1440, height: 640 },
  { width: 1440, height: 900 },
  { width: 1920, height: 900 },
  { width: 1920, height: 1200 },
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
      const renderedHero =
        viewport.width < 768 ? page.getByTestId("mobile-hero-static") : page.locator("figure canvas");
      await expect(renderedHero).toBeVisible({ timeout: 15_000 });
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
      const renderedHeroBox = await renderedHero.boundingBox();
      expect(figure).not.toBeNull();
      expect(renderedHeroBox).not.toBeNull();
      expect(renderedHeroBox!.height).toBeLessThanOrEqual(figure!.height + 1);
      expect(figure!.height - renderedHeroBox!.height).toBeLessThanOrEqual(10);
      await expectNoPageOverflow(page);

      // At 768 and 1100 the hero also leaves room for enlarged text.
      if (viewport.width === 768 || viewport.width === 1100) await expectRoomForEnlargedText(page, viewport.width);
    } finally {
      await initialContext.close();
    }
  });
}
