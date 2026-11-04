import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { axeViolations } from "./axe";
import { expectEnglish } from "./expect-english";

// Year in review, /explorer/analysis (spec 2026-10-30-year-in-review-design): one year from every angle, moved by
// one year ruler. The years named here are the data's: 2004 is the first budget year, 2020 the deepest deficit, 2026
// the plan year.

const SECTIONS = ["year-review-glance", "year-review-gives-up", "year-review-where", "year-review-debt", "year-review-country", "year-review-long"];

async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
}

/** The ruler's chosen year. */
async function chosenYear(page: Page): Promise<number> {
  return Number(await page.getByTestId("year-ruler").locator('[role="radio"][aria-checked="true"]').getAttribute("data-year"));
}

/** The ruler's chosen year, retried until it settles (the hash restore and a key step commit asynchronously). */
async function expectYear(page: Page, year: number) {
  await expect(page.getByTestId("year-ruler").locator('[role="radio"][aria-checked="true"]')).toHaveAttribute("data-year", String(year));
}

/** The ruler's years, first to last. */
const rulerYears = (page: Page) => page.getByTestId("year-ruler").getByRole("radio").evaluateAll((radios) => radios.map((radio) => Number(radio.getAttribute("data-year"))));

async function pickYear(page: Page, year: number) {
  await page.getByTestId("year-ruler").locator(`[data-year="${year}"]`).click();
  await expect(page.getByTestId("year-ruler").locator(`[data-year="${year}"]`)).toHaveAttribute("aria-checked", "true");
}

const hashParams = (page: Page) => Object.fromEntries(new URLSearchParams(new URL(page.url()).hash.slice(1)));

async function noSidewaysScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

for (const [locale, prefix, heading, line, actual] of [
  ["ka", "", "წლის მიმოხილვა", "ერთი წელი ყველა კუთხიდან", "ფაქტი"],
  ["en", "/en", "Year in review", "One year from every angle", "actuals"],
] as const) {
  test(`${locale}: the heading, its one line, the ruler on the latest actual year and the six sections`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await open(page, `${prefix}/explorer/analysis`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    const lead = page.getByTestId("year-review-line");
    await expect(lead).toHaveText(line);
    // One line at 375px (decision D1).
    expect(await lead.evaluate((element) => element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight))).toBeLessThan(1.5);

    // The page opens on the newest year with actual spending: every later year is a plan.
    const radios = page.getByTestId("year-ruler").getByRole("radio");
    const labels = await radios.evaluateAll((elements) => elements.map((element) => ({ year: Number(element.getAttribute("data-year")), label: element.getAttribute("aria-label")! })));
    const planWord = locale === "ka" ? "გეგმა" : "plan";
    const opened = await chosenYear(page);
    for (const { year, label } of labels) expect(label.endsWith(`, ${planWord}`), label).toBe(year > opened);
    expect(labels.at(-1)!.year).toBeGreaterThan(opened);
    await expect(page.locator("#year-review-glance h2")).toHaveText(locale === "ka" ? `${opened} ერთ სურათზე` : `${opened} at a glance`);

    const tops = await Promise.all(SECTIONS.map(async (id) => (await page.locator(`#${id}`).boundingBox())!.y));
    expect(tops).toEqual([...tops].sort((a, b) => a - b));
    await expect(page.locator("main h2")).toHaveCount(SECTIONS.length + 1);
    await expect(page.locator('[data-kpi]')).toHaveCount(6);
    // What changed compares an actual year with an actual one.
    await expect(page.locator('#year-review-where [data-panel="change"] h3')).toContainText(actual);
    // No Excel download and no footer on this page.
    await expect(page.getByTestId("series-excel")).toHaveCount(0);
    await expect(page.getByRole("contentinfo")).toHaveCount(0);
    await noSidewaysScroll(page);
  });
}

test("the ruler moves every section, and 2020 reads as the deepest deficit in the series", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page, "/explorer/analysis");
  const spend = page.locator('[data-kpi="spend"]');
  const before = await spend.innerText();
  const sectionsBefore = await Promise.all(SECTIONS.map((id) => page.locator(`#${id}`).innerText()));
  await pickYear(page, 2020);
  await expect.poll(() => hashParams(page).ay).toBe("2020");
  await expect(page.locator("#year-review-glance h2")).toHaveText("2020 ერთ სურათზე");
  await expect(spend).not.toHaveText(before);
  await expect(spend).toContainText("2019 წელთან");
  // balMax: the largest deficit since the series began.
  await expect(page.locator('[data-kpi="balance"]')).toContainText(/დეფიციტი — ყველაზე დიდი \d{4} წლიდან/);
  await expect(page.locator("#year-review-where")).toContainText("2020 · სახელმწიფო ბიუჯეტი");
  await expect(page.locator('#year-review-where [data-panel="change"] h3')).toContainText("რა შეიცვალა 2019 წელთან შედარებით");
  await expect(page.locator('#year-review-long [data-chosen-label]')).toHaveText("2020");
  // Every section redraws for the new year, 02, 04 and 05 included.
  for (const [index, id] of SECTIONS.entries()) await expect(page.locator(`#${id}`), id).not.toHaveText(sectionsBefore[index]!);

  // The keys step the ruler (←/↑ back, →/↓ on, Home and End to the ends): the chosen year keeps the focus.
  const years = await rulerYears(page);
  await page.getByTestId("year-ruler").locator('[data-year="2020"]').focus();
  for (const [key, year] of [["ArrowRight", 2021], ["ArrowDown", 2022], ["ArrowUp", 2021], ["ArrowLeft", 2020], ["End", years.at(-1)!]] as const) {
    await page.keyboard.press(key);
    await expectYear(page, year);
    await expect(page.getByTestId("year-ruler").locator(`[data-year="${year}"]`), key).toBeFocused();
  }
  await page.keyboard.press("Home");
  await expectYear(page, years[0]!);
  // The first year has nothing to compare with.
  await expect(page.locator('#year-review-where [data-panel="change"]')).toContainText(`${years[0]} პირველი წელია მონაცემებში`);
  await expect(spend).toContainText("პირველი წელი");
});

test("the grouping, side and measure switches redraw their sections", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page, "/explorer/analysis");
  const where = page.locator("#year-review-where");
  const rankIds = () => where.locator("button[data-rank-row]").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-rank-row")));
  const fields = await rankIds();
  await expect(where.locator("[data-cell]")).toHaveCount(100);

  await where.getByRole("group", { name: "დაჯგუფება" }).getByRole("button", { name: "უწყებები" }).click();
  await expect(where.getByRole("group", { name: "დაჯგუფება" }).getByRole("button", { name: "უწყებები" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => hashParams(page).ag).toBe("ministries");
  await expect.poll(rankIds).not.toEqual(fields);
  await expect(where.locator("[data-cell]")).toHaveCount(100);

  const long = page.locator("#year-review-long");
  const bands = () => long.locator("path[data-band]").evaluateAll((paths) => paths.map((path) => path.getAttribute("data-band")));
  const institutions = await bands();
  // The long view follows the grouping on the expenditure side.
  expect([...institutions].sort()).toEqual([...(await rankIds())].sort());
  await long.getByRole("group", { name: "ბიუჯეტის მხარე" }).getByRole("button", { name: "შემოსავლები" }).click();
  await expect.poll(() => hashParams(page).as).toBe("revenue");
  // Redrawn with the receipts: VAT is a band, and no institution is.
  await expect.poll(bands).toContain("revenue.vat");
  for (const id of await bands()) expect(institutions).not.toContain(id);
  await expect(long.locator("[data-y-tick]")).toHaveCount(5);
  await expect(long.locator('[data-y-tick="1"]')).toHaveText("100%");

  await long.getByRole("group", { name: "საზომი" }).getByRole("button", { name: "ლარში" }).click();
  await expect(long.locator('[data-y-tick="1"]')).toHaveCount(0);
  await expect(long.locator("[data-y-tick]").last()).toContainText("მლრდ");
});

test("picking a category highlights it in sections 03 and 06, and the chip clears it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page, "/explorer/analysis");
  const row = page.locator("#year-review-where button[data-rank-row]").first();
  const id = (await row.getAttribute("data-rank-row"))!;
  await row.click();
  await expect(row).toHaveAttribute("aria-pressed", "true");
  // Away from the row, the pin alone keeps the highlight.
  await page.mouse.move(5, 5);
  await expect(row).toHaveAttribute("data-focus", "");
  await expect(page.locator("#year-review-where button[data-rank-row][data-dim]")).toHaveCount((await page.locator("#year-review-where button[data-rank-row]").count()) - 1);
  await expect(page.locator(`#year-review-long path[data-band="${id}"]`)).toHaveAttribute("data-focus", "");
  await expect(page.locator("#year-review-long path[data-band][data-dim]")).not.toHaveCount(0);
  await expect(page.locator(`#year-review-long button[data-legend="${id}"]`)).toHaveAttribute("aria-pressed", "true");

  // The chip by the ruler names it; the ruler then speaks of that category.
  const chip = page.getByRole("button", { name: /^მონიშვნის მოხსნა: / });
  await expect(chip).toBeVisible();
  const label = (await chip.getAttribute("aria-label"))!.replace("მონიშვნის მოხსნა: ", "");
  await expect(page.getByTestId("year-ruler")).toHaveAttribute("aria-label", `${label} წლების მიხედვით — აირჩიეთ წელი`);
  await chip.click();
  await expect(chip).toHaveCount(0);
  await expect(page.getByTestId("year-ruler").locator('[aria-checked="true"]')).toBeFocused();
  await expect(page.locator("#year-review-where [data-dim], #year-review-long [data-dim]")).toHaveCount(0);
  // The pick is not saved in the address.
  expect(page.url()).not.toContain(id);
});

test("an old Analysis link survives a reload and the language switch", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/explorer/analysis#ay=2024&ag=ministries&as=revenue");
  await page.reload();
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  const expectState = async (institutions: string, receipts: string) => {
    await expectYear(page, 2024);
    await expect(page.locator("#year-review-where").getByRole("button", { name: institutions, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#year-review-long").getByRole("button", { name: receipts, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => hashParams(page)).toEqual({ ay: "2024", ag: "ministries", as: "revenue" });
  };
  await expectState("უწყებები", "შემოსავლები");

  await page.getByTestId("language-switch").getByRole("link", { name: "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expectState("Institutions", "Receipts");
  await expectEnglish(page);

  await page.reload();
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expectState("Institutions", "Receipts");
});

test("the English page has no Georgian text in any year, grouping or readout", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page, "/en/explorer/analysis");
  await expectEnglish(page);
  for (const year of [2004, 2026]) {
    await pickYear(page, year);
    await expectEnglish(page);
  }
  await page.locator("#year-review-where").getByRole("button", { name: "Institutions", exact: true }).click();
  await expectEnglish(page);
  await page.locator("#year-review-where button[data-rank-row]").first().click();
  await expectEnglish(page);

  // The long view's readout and the deficit chart's readout read in English too.
  const plot = page.locator('#year-review-long [role="img"]');
  await plot.scrollIntoViewIfNeeded();
  const box = (await plot.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.6);
  await expect(page.getByTestId("long-view-tooltip")).toBeVisible();
  expect(await page.getByTestId("long-view-tooltip").innerText()).not.toMatch(/\p{Script=Georgian}/u);
});

test("the deficit chart's readout names a projection year as one", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page, "/explorer/analysis");
  const chart = page.locator('[data-chart="deficit"] svg[role="img"]:visible');
  await chart.scrollIntoViewIfNeeded();
  const box = (await chart.boundingBox())!;
  const period = page.getByTestId("stack-chart-tooltip").getByTestId("chart-tooltip-period");
  // The last column is a projection; the first an actual year.
  await page.mouse.move(box.x + box.width - 30, box.y + box.height / 2);
  await expect(period).toHaveText(/^\d{4} პროგნოზი$/);
  await page.mouse.move(box.x + 70, box.y + box.height / 2);
  await expect(period).toHaveText(/^\d{4}$/);
});

test("the plan year marks its figures as a plan and keeps every section filled", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page, "/explorer/analysis");
  const last = Number(await page.getByTestId("year-ruler").getByRole("radio").last().getAttribute("data-year"));
  // The screen-reader line says the chosen year's spending, and that it is a plan in a plan year.
  const said = page.getByTestId("year-review").locator(':scope > p[role="status"]');
  await expect(said).toHaveText(new RegExp(`^${await chosenYear(page)}: `));
  await expect(said).not.toContainText("გეგმა");
  await pickYear(page, last);
  await expect(said).toHaveText(new RegExp(`^${last}: .*, გეგმა$`));
  await expect(page.locator('[data-kpi="spend"] [data-plan-tag]')).toHaveText("გეგმა");
  await expect(page.locator('#year-review-where [data-panel="change"] h3')).toContainText(`${last} — გეგმა, ${last - 1} — ფაქტი`);
  // Datasets without the plan year show the year they use, never a blank: the tax breaks' own last year among them.
  await expect(page.locator('[data-kpi="breaks"] [data-year-tag]')).toHaveAttribute("data-year-tag", /^\d{4}$/);
  for (const id of SECTIONS) {
    const shown = await page.locator(`#${id}`).innerText();
    for (const bad of ["NaN", "Infinity", "undefined", "null", "{"]) expect(shown, `${id}: ${bad}`).not.toContain(bad);
  }
});

test("no sideways scroll on a 375px phone, and the ruler's labels never collide", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of ["/explorer/analysis", "/en/explorer/analysis#ay=2026&ag=ministries&as=revenue"]) {
    await open(page, path);
    await noSidewaysScroll(page);
    const labels = await page.getByTestId("year-ruler").locator("button > span:last-child").evaluateAll((spans) =>
      spans.filter((span) => getComputedStyle(span).visibility === "visible").map((span) => span.getBoundingClientRect()).map(({ left, right }) => ({ left, right })),
    );
    expect(labels.length).toBeGreaterThan(3);
    for (let index = 1; index < labels.length; index += 1) expect(labels[index]!.left, path).toBeGreaterThan(labels[index - 1]!.right);
    // The ice chart's labels and the rate lines' end labels stay on screen.
    const outside = await page.evaluate(() =>
      [...document.querySelectorAll('[data-ice] em, [data-ice] b, [data-panel="debt"] [role="img"] span span')]
        .map((element) => ({ text: element.textContent, box: element.getBoundingClientRect() }))
        .filter(({ box }) => box.width > 0 && (box.left < 0 || box.right > document.documentElement.clientWidth))
        .map(({ text }) => text),
    );
    expect(outside, path).toEqual([]);
  }
});

test("the half-width charts fit their column without sideways scroll at 1440px and 820px", async ({ page }) => {
  for (const width of [1440, 820]) {
    await page.setViewportSize({ width, height: 1000 });
    await open(page, "/explorer/analysis");
    const frames = page.getByTestId("stack-chart-frame");
    await expect(frames).toHaveCount(4);
    const scrolling = await frames.evaluateAll((elements) => elements.filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => element.getAttribute("aria-label")));
    expect(scrolling, String(width)).toEqual([]);
    await noSidewaysScroll(page);
  }
});

test("a jump to a section at 820px clears the top bar and the sticky ruler", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1000 });
  await open(page, "/explorer/analysis");
  const ruler = page.getByTestId("year-ruler").locator("..");
  for (const id of ["year-review-debt", "year-review-long"]) {
    await page.locator(`#${id}`).evaluate((element) => element.scrollIntoView());
    await expect.poll(async () => {
      const [section, sticky] = await Promise.all([page.locator(`#${id} h2`).boundingBox(), ruler.boundingBox()]);
      return section!.y - (sticky!.y + sticky!.height);
    }, { message: id }).toBeGreaterThanOrEqual(0);
  }
});

test("the page has no WCAG A or AA violations", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page, "/explorer/analysis");
  expect(await axeViolations(page)).toEqual([]);
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page, "/en/explorer/analysis");
  expect(await axeViolations(page)).toEqual([]);
});

// Spec §11: each share button produces a picture. Every chart has a button of its own (chart-share.spec.ts), and each
// one, the HTML-drawn ice, grid, bars, treemap, ledger and dots as well as the hatched stacked charts, makes a PNG.
const SHARE_IDS = [
  "ice-share", "refunds-share", "hundred-share", "change-share", "buys-share", "deficit-share", "rates-share", "debt-stock-share",
  "repayments-share", "per-resident-share", "regions-share", "long-view-share",
];

test("every chart's share button downloads a 2400px PNG", async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page, "/explorer/analysis");
  await expect(page.getByTestId("chart-share")).toHaveCount(0);
  await expect(page.locator('[data-testid$="-share"]')).toHaveCount(SHARE_IDS.length);
  for (const testId of SHARE_IDS) {
    const button = page.getByTestId(testId);
    await expect(button, testId).toHaveCount(1);
    await button.click();
    await expect(page.getByTestId(`${testId}-menu`)).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId(`${testId}-download`).click()]);
    const bytes = await readFile(await download.path());
    expect(bytes.subarray(1, 4).toString(), testId).toBe("PNG");
    expect(bytes.readUInt32BE(16), testId).toBe(2400);
    expect(bytes.readUInt32BE(20), testId).toBeGreaterThan(400);
    expect(download.suggestedFilename(), testId).toMatch(/^fiscal-analysis-\d{4}(-\d{4})?\.png$/);
    await expect(page.getByTestId(`${testId}-menu`)).toHaveCount(0);
  }
});

// Spec §1: the page ships less than the Analysis page it replaced; the budget is its size on 2026-10-30 (66 KB and
// 61 KB gzipped) with a little room.
const KA_HTML_GZIP_LIMIT = 75_000;
const EN_HTML_GZIP_LIMIT = 70_000;

test("the page's HTML stays inside its size budget", async ({ request }) => {
  for (const [prefix, limit] of [["", KA_HTML_GZIP_LIMIT], ["/en", EN_HTML_GZIP_LIMIT]] as const) {
    const html = await (await request.get(`${prefix}/explorer/analysis`)).text();
    expect(gzipSync(html).length, prefix || "/").toBeLessThan(limit);
  }
});

test("the ruler's focus ring sits inside its stop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page, "/explorer/analysis");
  await page.getByTestId("year-ruler").locator('[aria-checked="true"]').focus();
  await page.keyboard.press("ArrowLeft");
  const ring = await page.getByTestId("year-ruler").locator('[aria-checked="true"]').evaluate((element) => {
    const style = getComputedStyle(element);
    return { offset: style.outlineOffset, style: style.outlineStyle };
  });
  expect(ring).toEqual({ offset: "-2px", style: expect.not.stringMatching(/^none$/) });
});

test("hovering a grid cell, a treemap tile or a dot names what it is", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page, "/explorer/analysis");
  const where = page.locator("#year-review-where");
  // A cell of the hundred highlights its category's row.
  const cell = where.locator("[data-cell]").nth(40);
  const cellId = (await cell.getAttribute("data-cell"))!;
  await cell.hover();
  await expect(where.locator(`button[data-rank-row="${cellId}"]`)).toHaveAttribute("data-focus", "");
  await page.mouse.move(5, 5);
  await expect(where.locator("button[data-rank-row][data-focus]")).toHaveCount(0);
  // A treemap tile lights up and dims the others.
  const tiles = where.locator("[data-tile]:visible");
  const tile = tiles.first();
  await tile.hover();
  await expect(tile).toHaveAttribute("data-focus", "");
  await expect(where.locator("[data-tile][data-dim]:visible")).toHaveCount((await tiles.count()) - 1);
  await page.mouse.move(5, 5);
  // A municipality's dot names it with its figure (spec §4).
  const country = page.locator("#year-review-country");
  const dot = country.locator("[data-dot]").first();
  await dot.scrollIntoViewIfNeeded();
  await dot.hover();
  await expect(country.locator("[data-dot-label]")).toHaveCount(1);
  await expect(country.locator("[data-dot-label]")).toHaveText(/^\S.* · [\d,]+ ₾$/);
});

for (const [width, height] of [[1440, 1000], [375, 812]] as const) {
  test(`pressing a region at ${width}px lists its municipalities, and pressing again hides them`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page, "/explorer/analysis");
    const country = page.locator("#year-review-country");
    const regions = country.locator("[data-region-row] > button");
    const regionOf = (button: Locator) => button.evaluate((element) => element.parentElement!.getAttribute("data-region-row")!);
    const first = regions.nth(0);
    const id = await regionOf(first);
    await first.click();
    await expect(first).toHaveAttribute("aria-pressed", "true");
    const list = country.locator(`[data-region-places="${id}"]`);
    await expect(list).toBeVisible();
    await expect(first).toHaveAttribute("aria-controls", (await list.getAttribute("id"))!);
    // One row per municipality of the region, a name and its figure, highest first.
    await expect(list.locator("li")).toHaveCount(await country.locator(`[data-region-row="${id}"] [data-dot]`).count());
    const rows = await list.locator("li").evaluateAll((items) => items.map((item) => [item.children[0]!.textContent!, item.children[1]!.textContent!]));
    for (const [name, figure] of rows) {
      expect(name).toMatch(/\S/);
      expect(figure).toMatch(/^[\d,]+ ₾$/);
    }
    const figures = rows.map(([, figure]) => Number(figure!.replace(/[^\d]/g, "")));
    expect(figures).toEqual([...figures].sort((a, b) => b - a));
    await noSidewaysScroll(page);

    // Pressing again hides it; the keyboard opens another region's, and a second region moves the list.
    await first.click();
    await expect(country.locator("[data-region-places]")).toHaveCount(0);
    await expect(first).not.toHaveAttribute("aria-controls");
    const second = regions.nth(1);
    await second.focus();
    await page.keyboard.press("Enter");
    await expect(country.locator(`[data-region-places="${await regionOf(second)}"]`)).toBeVisible();
    await first.focus();
    await page.keyboard.press("Space");
    await expect(country.locator("[data-region-places]")).toHaveCount(1);
    await expect(list).toBeVisible();
    await expect(second).toHaveAttribute("aria-pressed", "false");

    // The share picture never shows the list: opening it mounts the card, and the page still has one list.
    await page.getByTestId("regions-share").click();
    await expect(page.getByTestId("regions-share-menu")).toBeVisible();
    await expect(page.locator("[data-region-places]")).toHaveCount(1);
    await page.keyboard.press("Escape");
    if (width === 1440) expect(await axeViolations(page)).toEqual([]);
  });
}

test("the status line speaks once a run of year steps settles, and names a pinned category", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page, "/explorer/analysis");
  const [first] = await rulerYears(page);
  const said = page.getByTestId("year-review").locator(':scope > p[role="status"]');
  await page.getByTestId("year-ruler").locator('[aria-checked="true"]').focus();
  await page.keyboard.press("Home");
  await expect(said).toHaveText(new RegExp(`^${first}: `));
  await said.evaluate((element) => {
    const heard: string[] = [];
    (window as unknown as { heard: string[] }).heard = heard;
    new MutationObserver(() => heard.push(element.textContent ?? "")).observe(element, { childList: true, characterData: true, subtree: true });
  });
  for (let step = 0; step < 3; step += 1) await page.keyboard.press("ArrowRight");
  await expectYear(page, first! + 3);
  await expect(said).toHaveText(new RegExp(`^${first! + 3}: `));
  // The steps between were not read out one by one.
  const heard = await page.evaluate(() => (window as unknown as { heard: string[] }).heard);
  expect([...new Set(heard.map((line) => line.slice(0, 4)))]).toEqual([String(first! + 3)]);

  // With a category pinned, the line speaks of it.
  await page.locator("#year-review-where button[data-rank-row]").first().click();
  const chip = page.getByRole("button", { name: /^მონიშვნის მოხსნა: / });
  const label = (await chip.getAttribute("aria-label"))!.replace("მონიშვნის მოხსნა: ", "");
  await page.getByTestId("year-ruler").locator('[aria-checked="true"]').focus();
  await page.keyboard.press("ArrowRight");
  await expect(said).toHaveText(new RegExp(`^${first! + 4}: ${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} — `));
});

test("the long view's readout follows the keys", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page, "/explorer/analysis");
  const years = await rulerYears(page);
  const plot = page.locator('#year-review-long [role="img"]');
  const tip = page.getByTestId("long-view-tooltip");
  await plot.scrollIntoViewIfNeeded();
  await plot.focus();
  await expect(plot).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(tip).toBeVisible();
  await expect(tip).toContainText(String(years[0]));
  // The readout a key moved is also spoken, once, through a polite live region.
  const said = page.getByTestId("long-view-said");
  await expect(said).toHaveAttribute("aria-live", "polite");
  await expect(said).toContainText(String(years[0]));
  await page.keyboard.press("End");
  await expect(tip).toContainText(`${years.at(-1)} · გეგმა`);
  await expect(said).toContainText(`${years.at(-1)} · გეგმა`);
  expect(await axeViolations(page)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(tip).toHaveCount(0);
  await expect(said).toHaveText("");
  // A pointer over the plot shows the readout but does not speak it.
  const box = (await plot.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(tip).toBeVisible();
  await expect(said).toHaveText("");
});

test("the page has no WCAG A or AA violations with a category picked or in the plan year", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page, "/explorer/analysis");
  await page.locator("#year-review-where button[data-rank-row]").first().click();
  await page.mouse.move(5, 5);
  expect(await axeViolations(page)).toEqual([]);
  await pickYear(page, (await rulerYears(page)).at(-1)!);
  expect(await axeViolations(page)).toEqual([]);
});

for (const width of [820, 1440]) {
  test(`at ${width}px a control reached by the keyboard is never hidden under the sticky ruler`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, "/explorer/analysis");
    const sticky = page.getByTestId("year-ruler").locator("..");
    for (const selector of ["#year-review-where button[data-rank-row]", "#year-review-country [data-region-row] > button", "#year-review-long button[data-legend]"]) {
      const target = page.locator(selector).nth(1);
      // The control sits just under the stuck ruler row; the next one has the focus, without scrolling.
      await target.evaluate((element) => window.scrollBy(0, element.getBoundingClientRect().top - 30));
      await expect.poll(async () => (await target.boundingBox())!.y, { message: selector }).toBeLessThan((await sticky.boundingBox())!.y + (await sticky.boundingBox())!.height);
      await page.locator(selector).nth(2).evaluate((element) => (element as HTMLElement).focus({ preventScroll: true }));
      await page.keyboard.press("Shift+Tab");
      await expect(target, selector).toBeFocused();
      await expect.poll(async () => {
        const [box, row] = await Promise.all([target.boundingBox(), sticky.boundingBox()]);
        return box!.y - (row!.y + row!.height);
      }, { message: selector }).toBeGreaterThanOrEqual(0);
    }
  });
}

test("a jump to a section at 1440px clears the sticky ruler", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page, "/explorer/analysis");
  const ruler = page.getByTestId("year-ruler").locator("..");
  for (const id of ["year-review-debt", "year-review-long"]) {
    await page.locator(`#${id}`).evaluate((element) => element.scrollIntoView());
    await expect.poll(async () => {
      const [section, sticky] = await Promise.all([page.locator(`#${id} h2`).boundingBox(), ruler.boundingBox()]);
      return section!.y - (sticky!.y + sticky!.height);
    }, { message: id }).toBeGreaterThanOrEqual(0);
  }
});

test.describe("on a touch phone", () => {
  test.use({ hasTouch: true, viewport: { width: 375, height: 812 } });

  test("a swipe up or down over the ruler scrolls and keeps the year; a tap picks; a sideways drag picks with the year above the finger", async ({ page }) => {
    await open(page, "/explorer/analysis");
    const ruler = page.getByTestId("year-ruler");
    const years = await rulerYears(page);
    const opened = await chosenYear(page);
    const hash = new URL(page.url()).hash;
    const box = (await ruler.boundingBox())!;
    const xOf = (year: number) => box.x + ((years.indexOf(year) + 0.5) / years.length) * box.width;
    const y = box.y + box.height / 2;
    const finger = (type: string, x: number, at: number) =>
      ruler.dispatchEvent(type, { pointerType: "touch", pointerId: 7, isPrimary: true, clientX: x, clientY: at, button: type === "pointermove" ? -1 : 0, buttons: type === "pointerdown" || type === "pointermove" ? 1 : 0, bubbles: true });

    // A real vertical swipe that starts on a stop scrolls the page; the browser cancels the touch and the year stays.
    const cdp = await page.context().newCDPSession(page);
    const scrolled = await page.evaluate(() => window.scrollY);
    const swipe = { x: xOf(years[2]!), y };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [swipe] });
    for (let step = 1; step <= 10; step += 1) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: swipe.x + 1, y: swipe.y - step * 20 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrolled);
    await expectYear(page, opened);
    expect(new URL(page.url()).hash).toBe(hash);
    await page.evaluate(() => window.scrollTo(0, 0));

    // The same move as pointer events: down on a stop, 40px down and 2px sideways, then cancelled or lifted there.
    for (const end of ["pointercancel", "pointerup"]) {
      await finger("pointerdown", xOf(years[2]!), y);
      await finger("pointermove", xOf(years[2]!) + 2, y + 40);
      await finger(end, xOf(years[2]!) + 2, y + 40);
      await expectYear(page, opened);
    }
    await expect(ruler.locator("[data-ruler-scrub]")).toHaveCount(0);

    // A tap picks the stop under the finger. As pointer events on the ruler alone, with no click, so the year is the
    // ruler's own tap branch and not a stop's click handler; a real tap then takes the click path too.
    await finger("pointerdown", xOf(years[4]!), y);
    await finger("pointerup", xOf(years[4]!), y);
    await expectYear(page, years[4]!);
    await ruler.locator(`[data-year="${years[6]}"]`).tap();
    await expectYear(page, years[6]!);

    // A sideways drag picks as it goes, with the chosen year shown above the finger, and ends on the stop it is lifted over.
    await finger("pointerdown", xOf(years[4]!), y);
    await finger("pointermove", xOf(years[4]!) + 14, y + 1);
    await finger("pointermove", xOf(years[9]!), y + 2);
    await expect(ruler.locator("[data-ruler-scrub]")).toBeVisible();
    await expect(ruler.locator("[data-ruler-scrub]")).toHaveText(String(years[9]));
    await expectYear(page, years[9]!);
    await finger("pointerup", xOf(years[9]!), y + 2);
    await expect(ruler.locator("[data-ruler-scrub]")).toHaveCount(0);
    await expectYear(page, years[9]!);
    await noSidewaysScroll(page);
  });

  test("a tap on the long view shows its readout under the chart", async ({ page }) => {
    await open(page, "/en/explorer/analysis");
    const plot = page.locator('#year-review-long [role="img"]');
    await plot.scrollIntoViewIfNeeded();
    await plot.tap();
    await expect(page.getByTestId("long-view-panel")).toBeVisible();
    await expect(page.getByTestId("long-view-tooltip")).toBeHidden();
    const [panel, chart] = await Promise.all([page.getByTestId("long-view-panel").boundingBox(), plot.boundingBox()]);
    expect(panel!.y).toBeGreaterThanOrEqual(chart!.y + chart!.height);
    await noSidewaysScroll(page);
  });
});
