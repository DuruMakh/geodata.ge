import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
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

  // The keys step the ruler: the chosen year keeps the focus.
  await page.getByTestId("year-ruler").locator('[data-year="2020"]').focus();
  await page.keyboard.press("ArrowRight");
  expect(await chosenYear(page)).toBe(2021);
  await expect(page.getByTestId("year-ruler").locator('[data-year="2021"]')).toBeFocused();
  await page.keyboard.press("Home");
  expect(await chosenYear(page)).toBe(2004);
  // The first year has nothing to compare with.
  await expect(page.locator('#year-review-where [data-panel="change"]')).toContainText("2004 პირველი წელია მონაცემებში");
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
  expect(institutions.sort()).toEqual([...(await rankIds())].sort());
  await long.getByRole("group", { name: "ბიუჯეტის მხარე" }).getByRole("button", { name: "შემოსავლები" }).click();
  await expect.poll(() => hashParams(page).as).toBe("revenue");
  await expect.poll(bands).not.toEqual(institutions);
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
    expect(await chosenYear(page)).toBe(2024);
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
  await pickYear(page, last);
  await expect(page.locator('[data-kpi="spend"] [data-plan-tag]')).toHaveText("გეგმა");
  await expect(page.locator('#year-review-where [data-panel="change"] h3')).toContainText(`${last} — გეგმა, ${last - 1} — ფაქტი`);
  // Datasets without the plan year show the year they use, never a blank.
  await expect(page.locator("[data-year-tag]")).not.toHaveCount(0);
  for (const id of SECTIONS) await expect(page.locator(`#${id}`)).not.toContainText("NaN");
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

test("a chart's share button downloads a 2400px PNG", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page, "/explorer/analysis");
  const shares = page.getByTestId("chart-share");
  expect(await shares.count()).toBeGreaterThanOrEqual(10);
  const button = page.locator("#year-review-long").getByTestId("chart-share");
  await button.click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#year-review-long").getByTestId("chart-share-download").click()]);
  const bytes = await readFile(await download.path());
  expect(bytes.subarray(1, 4).toString()).toBe("PNG");
  expect(bytes.readUInt32BE(16)).toBe(2400);
  expect(download.suggestedFilename()).toMatch(/^fiscal-.+\.png$/);
});
