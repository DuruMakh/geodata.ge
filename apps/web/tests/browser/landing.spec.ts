import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { NAV_TREE } from "../../lib/navigation/navTree";
import enLanding from "../../lib/i18n/messages/en/landing.json";
import kaLanding from "../../lib/i18n/messages/ka/landing.json";
import { computedCssColorAlpha } from "./focus-outline";

// Homepage (DESIGN.md §19): the hero, the country figures, the ten data chapters with their charts,
// sources, Ask AI and the site footer, and the paths into the explorer. The hero is a static image
// below 768px and WebGL at wider sizes; tests assert the matching visual mounts rather than pixel content.

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

// The copy each language must render. Figures are not listed: they come from the
// served data, so the tests check their shape and that they agree with each other.
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
    messages: kaLanding,
    methodologyLink: "მეთოდოლოგიის ნახვა →",
    methodology: "მეთოდოლოგია",
    otherLanguage: "English",
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
    messages: enLanding,
    methodologyLink: "View methodology →",
    methodology: "Methodology",
    otherLanguage: "ქართული",
  },
} as const;

// The ten chapters in page order, with the explorer page each heading leads to and the canvases each draws.
// Chapters 06 and 07 take their heading from the data (DESIGN.md §19), so they list every wording they can have.
const CHAPTERS = [
  { id: "ch-01", path: "/explorer/analysis", titleKeys: ["landing.ch1.title"], canvases: 1 },
  { id: "ch-02", path: "/explorer/expenditure", titleKeys: ["landing.ch2.title"], canvases: 1 },
  { id: "ch-03", path: "/explorer/revenue", titleKeys: ["landing.ch3.title"], canvases: 1 },
  { id: "ch-04", path: "/explorer/municipalities", titleKeys: ["landing.ch4.title"], canvases: 1 },
  { id: "ch-05", path: "/explorer/deficit", titleKeys: ["landing.ch5.title"], canvases: 1 },
  { id: "ch-06", path: "/explorer/demography", titleKeys: ["landing.ageing.heading.ageing", "landing.ageing.heading.changing"], canvases: 3 },
  {
    id: "ch-07",
    path: "/explorer/unemployment",
    titleKeys: ["notHigher", "littleHigher", "oneAndHalf", "almostTwice", "twice", "moreThanTwice"].map((word) => `landing.jobs.heading.${word}`),
    canvases: 3,
  },
  { id: "ch-08", path: "/explorer/wages", titleKeys: ["landing.ch8.title"], canvases: 1 },
  { id: "ch-09", path: "/explorer/trade", titleKeys: ["landing.ch9.title"], canvases: 2 },
  { id: "ch-10", path: "/explorer/health/causes-of-death", titleKeys: ["landing.ch10.title"], canvases: 1 },
] as const;
const CHAPTER_IDS = CHAPTERS.map((chapter) => chapter.id);
// The hero's canvas plus every chapter canvas.
const MAIN_CANVASES = 1 + CHAPTERS.reduce((sum, chapter) => sum + chapter.canvases, 0);

/** The chapter's heading text is one of its possible titles, in the page's language. */
function titlePattern(chapter: (typeof CHAPTERS)[number], messages: Record<string, string>) {
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(chapter.titleKeys.map((key) => escape(messages[key]!)).join("|"));
}

// Software-GL drivers in a container log these on every WebGL canvas, the hero included; they are not app output.
const SOFTWARE_GL_NOISE = /GPU stall|ReadPixels|GL Driver Message|software WebGL|SwiftShader/i;

const text = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();

for (const [locale, copy] of Object.entries(LANDING_COPY)) {
  test(`landing renders the redesigned composition: ${locale}`, async ({ page }) => {
    const href = (path: string) => `${copy.prefix}${path}`;
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`${baseUrl}${copy.prefix}/`);

    await expect(page).toHaveTitle(copy.title);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", copy.description);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.heading);
    await expect(page.getByText(copy.portal, { exact: true })).toBeVisible();
    await expect(page.getByTestId("hero-cta")).toHaveText(copy.cta);
    await expect(page.getByTestId("hero-cta")).toHaveAttribute("href", href("/explorer"));
    await expect(page.locator(".landing-hero-frame canvas").or(page.getByText(copy.heroFallback))).toBeVisible({ timeout: 15_000 });

    // Population and area are maintained by hand; the economic size is the latest nominal GDP, the same
    // figure and year as the GDP measure of chapter 01.
    const figures = page.getByTestId("key-numbers");
    await expect(figures).toContainText(copy.population);
    await expect(figures).toContainText(copy.populationCaption);
    await expect(figures).toContainText(copy.area);
    const gdpFigure = figures.locator("[data-country-stat]").nth(2);
    const gdpValue = text(await gdpFigure.locator(":scope > div").nth(1).textContent()).split(" ")[0];
    expect(gdpValue).toMatch(/^[\d.,]+$/);
    const gdpMeasure = page.locator("#ch-01 [role=group] button").first();
    await expect(gdpMeasure).toContainText(copy.messages["landing.scale.gdp"]);
    expect(text(await gdpMeasure.textContent())).toContain(gdpValue);
    const gdpYear = text(await gdpFigure.textContent()).match(/\b(\d{4})\b/)?.[1];
    expect(gdpYear).toBeDefined();
    await expect(page.locator("#ch-01 figure")).toContainText(`, ${gdpYear}`);
    await expectNoPageOverflow(page);

    // Ten chapters, each with its heading link, a lede, and its chart canvases.
    for (const chapter of CHAPTERS) {
      const section = page.locator(`#${chapter.id}`);
      await expect(section.getByRole("heading", { level: 2 })).toContainText(titlePattern(chapter, copy.messages));
      expect(text(await section.locator("h2 + p").textContent()).length, `${chapter.id} lede`).toBeGreaterThan(20);
      await expect(section.locator("canvas")).toHaveCount(chapter.canvases);
    }
    expect(await page.locator("main canvas").evaluateAll((canvases) => canvases.length)).toBe(MAIN_CANVASES);

    // Sources: the methodology link, and the dark AI band with the address to copy.
    await expect(page.locator("#sources").getByRole("link", { name: copy.methodologyLink })).toHaveAttribute("href", href("/methodology"));
    await expect(page.locator("#ai").getByTestId("landing-ai-copy")).toBeVisible();
    await expect(page.locator("#ai code")).toHaveText("https://fiscal.ge/mcp");
    await expect(page.locator("#ai").getByRole("link", { name: copy.messages["landing.ai.cta"] })).toHaveAttribute("href", href("/connect"));

    // Methodology stays out of the landing header and in the footer.
    await expect(page.getByTestId("landing-header").getByRole("link", { name: copy.methodology })).toHaveCount(0);
    const footer = page.getByTestId("site-footer");
    await expect(footer.getByRole("link", { name: "info@fiscal.ge" })).toHaveAttribute("href", "mailto:info@fiscal.ge");
    await expect(footer).toContainText("CC BY 4.0");
    await expect(footer.getByRole("link", { name: copy.methodology, exact: true })).toHaveAttribute("href", href("/methodology"));
    await expect(footer.getByTestId("footer-language-link")).toHaveAttribute("href", locale === "ka" ? "/en" : "/");
  });
}

test("homepage sections appear in the approved order", async ({ page }) => {
  for (const prefix of ["", "/en"]) {
    await page.goto(`${baseUrl}${prefix}/`);
    const order = await page.evaluate((ids) => {
      const top = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().top;
      return [...ids, "#sources", "#ai", "footer[data-variant=site]"].map((selector) => ({
        selector,
        top: top(selector) ?? null,
        // The chapters are direct children of main, the footer follows main.
        inMain: document.querySelector("main")?.contains(document.querySelector(selector)) ?? false,
      }));
    }, CHAPTER_IDS.map((id) => `#${id}`));
    for (const entry of order) expect(entry.top, `${prefix || "/"} ${entry.selector} exists`).not.toBeNull();
    const tops = order.map((entry) => entry.top!);
    expect(tops, `${prefix || "/"} section order`).toEqual([...tops].sort((a, b) => a - b));
    expect(order.map((entry) => entry.inMain)).toEqual([...CHAPTER_IDS.map(() => true), true, true, false]);
    // The key-number row sits above the first chapter.
    const keyNumbers = (await page.getByTestId("key-numbers").boundingBox())!;
    expect(keyNumbers.y).toBeLessThan(tops[0]!);
  }
});

test("chapter headings link to their explorer pages", async ({ page }) => {
  for (const [locale, copy] of Object.entries(LANDING_COPY)) {
    await page.goto(`${baseUrl}${copy.prefix}/`);
    for (const chapter of CHAPTERS) {
      const link = page.locator(`#${chapter.id} h2 a`);
      await expect(link, `${locale} ${chapter.id}`).toHaveAttribute("href", `${copy.prefix}${chapter.path}`);
      await expect(link).toContainText(titlePattern(chapter, copy.messages));
    }
  }
  // The sources heading is not a link; it is a section about the page's own method.
  await page.goto(`${baseUrl}/`);
  await expect(page.locator("#sources h2 a")).toHaveCount(0);
});

test("the society chapters show their data numbers", async ({ page }) => {
  // The latest values of the served data (the numbers are the same in both languages).
  const expected = [
    { id: "ch-06", number: "108.8", cards: 4, what: "women per 100 men" },
    { id: "ch-07", number: "25.4%", cards: 0, what: "youth unemployment rate in the lede" },
    { id: "ch-08", number: "2,165", cards: 4, what: "average wage" },
    { id: "ch-09", number: "25.9", cards: 3, what: "trade turnover" },
    { id: "ch-10", number: "44,319", cards: 0, what: "deaths in the lede" },
  ];
  for (const prefix of ["", "/en"]) {
    await page.goto(`${baseUrl}${prefix}/`);
    for (const { id, number, cards, what } of expected) {
      const section = page.locator(`#${id}`);
      // The numbers are real HTML, not canvas pixels: a stat card or the lede carries each one.
      await expect(section, `${prefix || "/"} ${id} ${what}`).toContainText(number);
      await expect(section.locator("[data-stat]"), `${prefix || "/"} ${id} stat cards`).toHaveCount(cards);
      // Chapters without cards carry their number in the lede.
      if (cards === 0) await expect(section.locator("h2 + p"), `${prefix || "/"} ${id} lede`).toContainText(number);
    }
  }
});

test.describe("society chart tooltips on hover", () => {
  // Reduced motion draws every chart in its final state, so a hover is read at once.
  test.use({ viewport: { width: 1440, height: 900 } });

  // Each chart: the canvas inside its chapter (in page order) and the labels its tooltip must carry.
  const charts = (messages: Record<string, string>) => [
    { name: "population pyramid", id: "ch-06", index: 0, labels: [messages["landing.ageing.men"], messages["landing.ageing.women"], messages["landing.ageing.pyramid.bothSexes"]] },
    { name: "net migration bars", id: "ch-06", index: 1, labels: [messages["landing.ageing.migration.label"]] },
    { name: "births map", id: "ch-06", index: 2, labels: [messages["landing.ageing.map.perHundred"], messages["landing.ageing.map.births"], messages["landing.ageing.map.deaths"]] },
    { name: "waffle, all aged 15+", id: "ch-07", index: 0, labels: [messages["landing.jobs.waffle.allWho"]] },
    { name: "waffle, aged 15-29", id: "ch-07", index: 1, labels: [messages["landing.jobs.waffle.youthWho"]] },
    { name: "regions", id: "ch-07", index: 2, labels: [messages["landing.jobs.regions.rate"]!.split(",")[0]!] },
    { name: "wages dumbbell", id: "ch-08", index: 0, labels: [messages["landing.wages.tipFoot"]!.split("{pct}")[0]!] },
    { name: "trade butterfly", id: "ch-09", index: 0, labels: [messages["landing.trade.exports"], messages["landing.trade.imports"], messages["landing.trade.balanceName"]] },
    { name: "trade lines", id: "ch-09", index: 1, labels: [messages["landing.trade.exports"], messages["landing.trade.imports"]] },
    { name: "causes of death", id: "ch-10", index: 0, labels: [messages["landing.deaths.tip.people"], messages["landing.deaths.tip.ofAll"]] },
  ];

  for (const [locale, copy] of Object.entries(LANDING_COPY)) {
    test(`hovering each society chart shows a tooltip: ${locale}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`${baseUrl}${copy.prefix}/`);
      for (const chart of charts(copy.messages)) {
        const canvas = page.locator(`#${chart.id} canvas`).nth(chart.index);
        // The tooltip sits next to its canvas inside the chart's own figure.
        const tip = canvas.locator("xpath=..").locator("[data-chart-tip]");
        await canvas.scrollIntoViewIfNeeded();
        await expect.poll(() => canvas.evaluate((element) => (element as HTMLCanvasElement).style.width !== ""), { message: `${chart.name} drawn` }).toBe(true);
        const box = (await canvas.boundingBox())!;
        // Charts pick their mark by position, so look for one: the centre first, then across the canvas.
        let shown = false;
        for (const fy of [0.5, 0.25, 0.75, 0.1, 0.9]) {
          for (const fx of [0.5, 0.25, 0.75, 0.1, 0.9]) {
            await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy);
            shown = (await tip.evaluate((element) => getComputedStyle(element).opacity)) === "1";
            if (shown) break;
          }
          if (shown) break;
        }
        expect(shown, `${locale} ${chart.name} tooltip appears on hover`).toBe(true);
        const content = text(await tip.textContent());
        expect(content, `${locale} ${chart.name} tooltip has a number`).toMatch(/\d/);
        for (const label of chart.labels) expect(content, `${locale} ${chart.name} tooltip`).toContain(text(label));
        // Leaving the canvas hides it again.
        await page.mouse.move(0, 0);
        await expect(tip, `${locale} ${chart.name} tooltip after leaving`).toHaveCSS("opacity", "0");
      }
    });
  }
});

test("choosing a measure updates the readout", async ({ page }) => {
  for (const [locale, copy] of Object.entries(LANDING_COPY)) {
    await page.goto(`${baseUrl}${copy.prefix}/`);
    const debt = page.locator("#ch-01 [role=group] button", { hasText: copy.messages["landing.scale.debt"] });
    await expect(debt, `${locale} debt measure`).toHaveCount(1);
    const readout = page.locator("#ch-01 [aria-live=polite]");
    // Spending is the default, and the readout names it.
    await expect(page.locator("#ch-01 [role=group] button[aria-pressed=true]")).toContainText(copy.messages["landing.scale.spending"]);
    await expect(readout).toContainText(copy.messages["landing.scale.spending"]);

    // The button carries "{label} {billions} {unit}"; the readout must show the same billions and a share of GDP.
    const billions = text(await debt.textContent()).match(/\d[\d.,]*/)![0];
    await debt.click();
    await expect(debt).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#ch-01 [role=group] button[aria-pressed=true]")).toHaveCount(1);
    await expect(readout).toContainText(copy.messages["landing.scale.debt"]);
    await expect(readout).toContainText(billions);
    await expect(readout).toContainText(new RegExp(`\\d+(\\.\\d)?%\\s*${copy.messages["landing.scale.ofGdp"]}`));
    await expect(readout).toContainText(copy.messages["landing.scale.square"]);
  }
});

test("the year slider and play button change the spending year", async ({ page }) => {
  await page.goto(`${baseUrl}/`);
  const chapter = page.locator("#ch-02");
  const range = chapter.locator('input[type="range"]');
  // The big year is the block right under the "Year" label.
  const bigYear = chapter.getByText(LANDING_COPY.ka.messages["landing.spending.year"], { exact: true }).locator("xpath=following-sibling::div[1]");
  const yearOf = async () => Number(await range.inputValue());

  const min = Number(await range.getAttribute("min"));
  const max = Number(await range.getAttribute("max"));
  expect(max).toBeGreaterThan(min);
  // The page opens on the latest year.
  await expect(range).toHaveValue(String(max));
  await expect(bigYear).toContainText(String(max));

  // Moving the slider to the first year shows that year in the big figure and above the side list.
  await range.fill(String(min));
  await expect(bigYear).toContainText(String(min));
  await expect(chapter.getByText(new RegExp(`${LANDING_COPY.ka.messages["landing.spending.listCaption"]} · ${min}`))).toBeVisible();

  // Play from the first year: the year advances within two seconds (one step is 900 ms).
  const play = chapter.locator("button:has(svg.lucide-play)");
  const pause = chapter.locator("button:has(svg.lucide-pause)");
  await expect(play).toHaveCount(1);
  await play.click();
  await expect(pause).toHaveCount(1);
  await expect.poll(yearOf, { timeout: 2_000 }).toBeGreaterThan(min);
  await expect(bigYear).toContainText(String(await yearOf()));

  // Pausing stops the advance: the year stays put for longer than one step.
  await pause.click();
  await expect(play).toHaveCount(1);
  const paused = await yearOf();
  await page.waitForTimeout(1_200);
  expect(await yearOf()).toBe(paused);
});

test("the spending chart plays on its own from the first year when it comes into view, and pause stops it", async ({ page }) => {
  await page.goto(`${baseUrl}/`);
  const chapter = page.locator("#ch-02");
  const range = chapter.locator('input[type="range"]');
  const yearOf = async () => Number(await range.inputValue());
  const min = Number(await range.getAttribute("min"));
  const max = Number(await range.getAttribute("max"));
  // Off screen it waits on the latest year.
  await expect(range).toHaveValue(String(max));

  await chapter.locator("figure").first().scrollIntoViewIfNeeded();
  const pause = chapter.locator("button:has(svg.lucide-pause)");
  await expect(pause).toHaveCount(1);
  // It starts from the first year and moves forward.
  await expect.poll(yearOf, { timeout: 3_000 }).toBeLessThan(max);
  const early = await yearOf();
  expect(early).toBeLessThanOrEqual(min + 3);
  await expect.poll(yearOf, { timeout: 2_000 }).toBeGreaterThan(early);

  await pause.click();
  await expect(chapter.locator("button:has(svg.lucide-play)")).toHaveCount(1);
  const paused = await yearOf();
  await page.waitForTimeout(1_200);
  expect(await yearOf()).toBe(paused);
});

test("under reduced motion the spending chart does not play on its own", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${baseUrl}/`);
  const chapter = page.locator("#ch-02");
  const range = chapter.locator('input[type="range"]');
  const max = await range.getAttribute("max");
  await chapter.locator("figure").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(1_500);
  await expect(range).toHaveValue(max!);
  await expect(chapter.locator("button:has(svg.lucide-pause)")).toHaveCount(0);
});

test("Enter and Space on a spending side-list row toggle its block's highlight, as a tap does", async ({ page }) => {
  // Reduced motion draws every change at once, so the canvas can be compared straight away.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${baseUrl}/`);
  const chapter = page.locator("#ch-02");
  const canvas = chapter.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  await expect.poll(() => canvas.evaluate((element) => (element as HTMLCanvasElement).style.width !== ""), { message: "treemap drawn" }).toBe(true);
  const picture = () => canvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL());
  const plain = await picture();
  const row = chapter.locator("button[data-field]").first();
  // Focus highlights the row's block; Enter turns it off and Space turns it on again.
  await row.focus();
  await expect.poll(picture, { message: "highlighted on focus" }).not.toBe(plain);
  const lit = await picture();
  await row.press("Enter");
  await expect.poll(picture, { message: "Enter toggles it off" }).toBe(plain);
  await row.press("Space");
  await expect.poll(picture, { message: "Space toggles it on" }).toBe(lit);
});

test("under reduced motion the squares show their final fill before the chart is in view", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}/`);
  const canvas = page.locator("#ch-01 canvas");
  // Only a sliver of the chart on screen: below the 25% that starts the intro animation.
  await canvas.evaluate((element) => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - window.innerHeight + 40));
  await expect.poll(() => canvas.evaluate((element) => (element as HTMLCanvasElement).style.width !== ""), { message: "squares drawn" }).toBe(true);
  const inkPixels = () =>
    canvas.evaluate((element) => {
      const c = element as HTMLCanvasElement;
      const { data } = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
      let dark = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i + 3]! > 200 && data[i]! < 90 && data[i + 1]! < 90 && data[i + 2]! < 90) dark += 1;
      return dark;
    });
  await expect.poll(inkPixels, { message: "filled squares are drawn" }).toBeGreaterThan(1000);
});

test("reduced motion shows final states", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${baseUrl}/`);
  // No scroll-reveal wait: every revealed block is already fully visible and in place.
  const hidden = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".home-rv")]
      .map((element) => ({ opacity: getComputedStyle(element).opacity, transform: getComputedStyle(element).transform, entered: element.hasAttribute("data-in") }))
      .filter((state) => state.opacity !== "1" || (state.transform !== "none" && state.transform !== "matrix(1, 0, 0, 1, 0, 0)")),
  );
  expect(hidden).toEqual([]);
  expect(await page.locator(".home-rv").count()).toBeGreaterThan(5);
  // The squares chart opens on its default measure with the marker label already in place.
  const selected = page.locator("#ch-01 [role=group] button[aria-pressed=true]");
  await expect(selected).toHaveCount(1);
  await expect(selected).toContainText(LANDING_COPY.ka.messages["landing.scale.spending"]);
  await expect(page.locator("#ch-01 [aria-live=polite]")).toContainText(LANDING_COPY.ka.messages["landing.scale.ofGdp"]);
  // The marker is already in place, and has no transition to wait for.
  const marker = page.locator("#ch-01 figure .pointer-events-none").first();
  await expect(marker).toHaveCSS("opacity", "1");
  expect(await marker.evaluate((element) => parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThan(0.001);
});

test.describe("chart tooltips on a touch screen", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  // pointerleave fires as soon as the finger lifts; a tapped tooltip must outlive it, as in the explorer charts.
  // The relief (ch-04) shares the same pointer handling (bindChartPointer) but picks places in 3D, so it is left out.
  test("a tapped chart keeps its tooltip until a tap outside or a scroll", async ({ page }) => {
    // Reduced motion puts every chart in its final state at once, so the tap is read straight away.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${baseUrl}/`);
    const opacity = (tip: Locator) => tip.evaluate((element) => getComputedStyle(element).opacity);
    for (const id of ["ch-01", "ch-02", "ch-03", "ch-05"]) {
      const chapter = page.locator(`#${id}`);
      const canvas = chapter.locator("canvas");
      const tip = chapter.locator("[data-chart-tip]");
      await canvas.scrollIntoViewIfNeeded();
      await expect.poll(() => canvas.evaluate((element) => (element as HTMLCanvasElement).style.width !== ""), { message: `${id} drawn` }).toBe(true);
      const box = (await canvas.boundingBox())!;
      await canvas.tap({ position: { x: box.width * 0.5, y: box.height * 0.6 } });
      await expect(tip, `${id} tooltip after the tap`).toHaveCSS("opacity", "1");
      await page.waitForTimeout(400);
      expect(await opacity(tip), `${id} tooltip after the finger lifted`).toBe("1");
      await chapter.locator("h2 + p").tap();
      await expect(tip, `${id} tooltip after a tap outside the chart`).toHaveCSS("opacity", "0");
    }

    const revenue = page.locator("#ch-03");
    const box = (await revenue.locator("canvas").boundingBox())!;
    await revenue.locator("canvas").tap({ position: { x: box.width * 0.5, y: box.height * 0.6 } });
    await expect(revenue.locator("[data-chart-tip]")).toHaveCSS("opacity", "1");
    await page.evaluate(() => window.scrollBy(0, 120));
    await expect(revenue.locator("[data-chart-tip]"), "tooltip after a scroll").toHaveCSS("opacity", "0");
  });
});

// With neither WebGL nor a 2D context (null, or a 2D context that throws), the relief shows its note
// and keeps its accessible summary instead of a blank stage or a crashed page.
for (const mode of ["null", "throw"] as const) {
  test(`the municipal relief shows its note when no canvas can draw (getContext ${mode})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript((failure) => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: unknown[]) {
        if (!this.closest(".home-muni-stage")) return (original as (...rest: unknown[]) => unknown).apply(this, args);
        if (failure === "throw" && args[0] === "2d") throw new Error("2D context refused");
        return null;
      } as typeof original;
    }, mode);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${baseUrl}/`);
    const stage = page.locator("#ch-04 .home-muni-stage");
    await stage.scrollIntoViewIfNeeded();
    await expect(stage.getByText(LANDING_COPY.ka.messages["landing.heroUnavailable"])).toBeVisible();
    await expect(stage.locator("canvas")).toHaveCount(0);
    await expect(stage.locator(".sr-only")).toContainText(LANDING_COPY.ka.messages["landing.municipal.chartSummary"]);
    // The rest of the page is still there.
    await expect(page.locator("#ch-05 canvas")).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}

test.describe("tap targets on a phone", () => {
  test.use({ isMobile: true, hasTouch: true, viewport: { width: 375, height: 812 } });

  // DESIGN.md §12 and §19: at least 44px tall below 768px, the chapter headings included even on one line.
  test("chapter heading links and the AI copy button are at least 44px tall", async ({ page }) => {
    for (const prefix of ["", "/en"]) {
      await page.goto(`${baseUrl}${prefix}/`);
      for (const chapter of CHAPTERS) {
        const link = page.locator(`#${chapter.id} h2 a`);
        const box = (await link.boundingBox())!;
        expect(box.height, `${prefix || "/"} ${chapter.id} heading link`).toBeGreaterThanOrEqual(44);
        expect(box.width, `${prefix || "/"} ${chapter.id} heading link width`).toBeGreaterThanOrEqual(300);
      }
      const copy = page.getByTestId("landing-ai-copy");
      await copy.scrollIntoViewIfNeeded();
      expect((await copy.boundingBox())!.height, `${prefix || "/"} copy button`).toBeGreaterThanOrEqual(44);
    }
  });
});

for (const width of [375, 390]) {
  test(`homepage has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    for (const prefix of ["", "/en"]) {
      await page.goto(`${baseUrl}${prefix}/`);
      await page.locator("footer[data-variant=site]").scrollIntoViewIfNeeded();
      const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
      expect(widths.scroll, `${prefix || "/"} at ${width}px`).toBeLessThanOrEqual(widths.inner);
      // Nothing inside a chapter pokes out of the viewport on the right either.
      const wide = await page.evaluate(
        (limit) =>
          [...document.querySelectorAll<HTMLElement>("main section *")]
            .filter((element) => element.getBoundingClientRect().right > limit + 1 && getComputedStyle(element).position !== "fixed")
            .filter((element) => !element.closest("[aria-hidden=true], canvas, svg"))
            .slice(0, 5)
            .map((element) => `${element.tagName.toLowerCase()}.${element.className} ${Math.round(element.getBoundingClientRect().right)}`),
        widths.inner,
      );
      expect(wide, `${prefix || "/"} elements wider than ${width}px`).toEqual([]);
    }
  });
}

test("site footer on the homepage and the site pages, compact footer on explorer pages", async ({ page }) => {
  for (const path of ["/", "/methodology", "/connect", "/about", "/en", "/en/methodology", "/en/connect", "/en/about"]) {
    await page.goto(`${baseUrl}${path}`);
    const footer = page.getByTestId("site-footer");
    await expect(footer, path).toHaveAttribute("data-variant", "site");
    await expect(footer.getByTestId("footer-language-link"), path).toHaveCount(1);
  }
  for (const path of ["/explorer/expenditure", "/en/explorer/expenditure"]) {
    await page.goto(`${baseUrl}${path}`);
    const footer = page.getByTestId("site-footer");
    await expect(footer, path).toHaveAttribute("data-variant", "compact");
    await expect(footer.getByTestId("footer-language-link"), path).toHaveCount(0);
  }
});

test("no console errors or warnings while scrolling the whole page", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  const warnings: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
    else if (message.type() === "warning" && !SOFTWARE_GL_NOISE.test(message.text())) warnings.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  for (const prefix of ["", "/en"]) {
    await page.goto(`${baseUrl}${prefix}/`);
    for (const id of [...CHAPTER_IDS, "sources", "ai"]) {
      await page.locator(`#${id}`).scrollIntoViewIfNeeded();
      await page.evaluate((target) => document.getElementById(target)?.scrollIntoView(), id);
    }
    await page.locator("footer[data-variant=site]").scrollIntoViewIfNeeded();
    // Each chart's engine has loaded and sized its canvas, so start-up and first-frame output is already logged.
    await expect
      .poll(() =>
        page.evaluate(
          (ids) => ids.flatMap((id) => [...document.querySelectorAll<HTMLCanvasElement>(`#${id} canvas`)].map((canvas) => canvas.style.width !== "")),
          CHAPTER_IDS,
        ),
      )
      .toEqual(Array.from({ length: MAIN_CANVASES - 1 }, () => true));
    await expect(page.getByText(LANDING_COPY[prefix === "" ? "ka" : "en"].messages["landing.heroUnavailable"])).toHaveCount(0);
  }

  expect(errors).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(warnings).toEqual([]);
});

test("landing data and methodology links use real destinations", async ({ page }) => {
  await page.goto(baseUrl);
  const dataNav = page.getByTestId("landing-header").getByRole("link", { name: "მონაცემები", exact: true });
  await expect(dataNav).toHaveAttribute("href", "/explorer");
  await expect(page.getByTestId("landing-header").getByRole("link", { name: "ექსპლორერი", exact: true })).toHaveCount(0);
  await page.getByTestId("hero-cta").click();
  await expect(page).toHaveURL(/\/explorer$/);
  await expect(page.getByTestId("explorer-shell")).toBeVisible();

  await page.goto(baseUrl);
  await page.locator("#ch-03 h2 a").click();
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
  await expect(page.locator(".landing-hero-frame canvas")).toHaveCount(0);

  const scriptsBeforeIdle = new Set(scriptRequests);
  expect(await heroRuntimeScripts(request, scriptsBeforeIdle)).toEqual([]);

  await page.evaluate(() =>
    (window as typeof window & { __flushHeroIdle: (didTimeout?: boolean) => void }).__flushHeroIdle(true),
  );
  await expect(page.locator(".landing-hero-frame canvas").or(page.getByText("ვიზუალი ვერ ჩაიტვირთა"))).toBeVisible({ timeout: 5_000 });

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
  await expect(page.locator(".landing-hero-frame canvas")).toHaveCount(0);
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
  await expect(page.locator(".landing-hero-frame canvas").or(page.getByText("ვიზუალი ვერ ჩაიტვირთა"))).toBeVisible();
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
  await expect(page.locator(".landing-hero-frame canvas").or(page.getByText("ვიზუალი ვერ ჩაიტვირთა"))).toBeVisible({ timeout: 5_000 });

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
    await expect(mobilePage.locator(".landing-hero-frame canvas")).toHaveCount(0);
    expect(await heroRuntimeScripts(request, mobileScripts)).toEqual([]);

    // Crossing the breakpoint live mounts exactly one desktop canvas and hides the static hero; crossing back unmounts it.
    const canvas = mobilePage.locator(".landing-hero-frame canvas");
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
    const canvas = desktopPage.locator(".landing-hero-frame canvas");
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
  const canvas = page.locator(".landing-hero-frame canvas");
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
  await expect(page.locator(".landing-hero-frame canvas").or(page.getByText("ვიზუალი ვერ ჩაიტვირთა"))).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { level: 1, name: "საქართველო ციფრებში" })).toBeVisible();
  const cta = page.getByTestId("hero-cta");
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute("href", "/explorer");
});

test("landing calls to action have visible keyboard focus", async ({ page }) => {
  await page.goto(baseUrl);

  await expectVisibleFocusOutline(page.getByTestId("hero-cta"));
  for (const chapter of CHAPTERS) await expectVisibleFocusOutline(page.locator(`#${chapter.id} h2 a`));
  await expectVisibleFocusOutline(page.locator("#sources").getByRole("link", { name: "მეთოდოლოგიის ნახვა →" }));
  await expectVisibleFocusOutline(page.getByTestId("landing-ai-copy"));
  await expectVisibleFocusOutline(page.locator("#ai").getByRole("link", { name: kaLanding["landing.ai.cta"] }));
});

test("landing keeps stats and chapters inside narrow viewports", async ({ page }) => {
  // 768 and 820: tablet portrait, where the two-column chapter layouts are narrowest (U01-23).
  for (const width of [390, 320, 768, 820]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(baseUrl);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByTestId("key-numbers").locator("[data-country-stat]")).toHaveCount(3);
    await expectNoPageOverflow(page);
    expect((await page.getByTestId("hero-cta").boundingBox())?.height ?? 0, `hero CTA at ${width}px`).toBeGreaterThanOrEqual(44);

    for (const chapter of CHAPTERS) {
      const heading = page.locator(`#${chapter.id} h2`);
      await expect(heading).toBeVisible();
      const box = (await heading.boundingBox())!;
      expect(box.x, `${chapter.id} heading at ${width}px`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${chapter.id} heading at ${width}px`).toBeLessThanOrEqual(width);
    }

    if (width === 320) await expect(page.getByTestId("population-unit")).toHaveCSS("display", "block");
  }
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
    // Logo, the address, every dataset hub, methodology, AI-კავშირი, მიზანი and the language link.
    await expect(links).toHaveCount(NAV_TREE.length + 6);
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
      return {
        line: style.textDecorationLine,
        color: style.textDecorationColor,
        thickness: style.textDecorationThickness,
        offset: style.textUnderlineOffset,
        headerBorder: getComputedStyle(header).borderBottomWidth,
      };
    });
    expect(decoration.line, `${viewport.width}px active label decoration`).toContain("underline");
    expect(decoration.color).toBe("rgb(179, 64, 42)");
    expect(decoration.thickness).toBe("2px");
    expect(decoration.offset).toBe("5px");
    expect(decoration.headerBorder).toBe("0px");
  }
});

async function expectRoomForEnlargedText(page: Page, width: number) {
  const initialCanvasHeight = (await page.locator(".landing-hero-frame canvas").boundingBox())!.height;

  // Text-only enlargement keeps the viewport and map scale unchanged.
  await page.locator("[data-hero-copy] p, [data-hero-copy] h1, [data-hero-copy] a").evaluateAll((elements) => {
    for (const element of elements) {
      (element as HTMLElement).style.fontSize = `${Number.parseFloat(getComputedStyle(element).fontSize) * 2}px`;
    }
  });
  await page.setViewportSize({ width: width + 1, height: 900 });
  await page.setViewportSize({ width, height: 900 });
  await expect.poll(async () => (await page.locator(".landing-hero-frame canvas").boundingBox())!.height).toBeGreaterThan(initialCanvasHeight);
  const copy = await page.locator("[data-hero-copy]").boundingBox();
  const stats = await page.getByTestId("key-numbers").boundingBox();
  expect(copy).not.toBeNull();
  expect(stats).not.toBeNull();
  const figure = await page.locator(".landing-hero-frame").boundingBox();
  const canvas = await page.locator(".landing-hero-frame canvas").boundingBox();
  expect(canvas!.height).toBeLessThanOrEqual(figure!.height + 1);
  expect(stats!.y).toBeGreaterThanOrEqual(copy!.y + copy!.height + 24);

  await page.locator("[data-hero-copy] p, [data-hero-copy] h1, [data-hero-copy] a").evaluateAll((elements) => {
    for (const element of elements) (element as HTMLElement).style.removeProperty("font-size");
  });
  await expect.poll(async () => {
    const frame = await page.locator(".landing-hero-frame").boundingBox();
    const canvas = await page.locator(".landing-hero-frame canvas").boundingBox();
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
      const initialFigure = await initialPage.locator(".landing-hero-frame").boundingBox();
      const initialStats = await initialPage.getByTestId("key-numbers").boundingBox();
      expect(initialFigure).not.toBeNull();
      expect(initialStats).not.toBeNull();

      await page.setViewportSize(viewport);
      await page.goto(baseUrl);
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      const renderedHero =
        viewport.width < 768 ? page.getByTestId("mobile-hero-static") : page.locator(".landing-hero-frame canvas");
      await expect(renderedHero).toBeVisible({ timeout: 15_000 });
      await expect.poll(async () => {
        const figure = await page.locator(".landing-hero-frame").boundingBox();
        const stats = await page.getByTestId("key-numbers").boundingBox();
        if (!figure || !stats) return Number.POSITIVE_INFINITY;
        return Math.max(
          Math.abs(figure.height - initialFigure!.height),
          Math.abs(stats.y - initialStats!.y),
        );
      }).toBeLessThanOrEqual(1);
      const figure = await page.locator(".landing-hero-frame").boundingBox();
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
