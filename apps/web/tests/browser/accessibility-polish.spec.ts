import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { NAV_TREE } from "../../lib/navigation/navTree";
import { expectReadableText } from "./color-contrast";

// Screen-reader and keyboard semantics from the 2026-10 platform review (Task 47), one page per
// template: picker popups, group names, live counts, heading levels and landmark names.

const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");

/** The h1–h4 headings inside main, as "level:text", in document order. */
const outline = (scope: Locator) =>
  scope.locator("h1, h2, h3, h4").evaluateAll((headings) => headings.map((heading) => `${heading.tagName[1]}:${heading.textContent?.trim()}`));

test("a place heading's picker names its popup, and Enter moves to the next page in the app with focus on its picker", async ({ page }) => {
  await page.goto("/en/explorer/economy/regions/imereti");
  await ready(page);
  const trigger = page.getByTestId("region-picker-trigger");
  await expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
  await expect(trigger).not.toHaveAttribute("aria-controls");
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  const popup = page.locator(`#${await trigger.getAttribute("aria-controls")}`);
  await expect(popup).toHaveRole("dialog");
  await expect(popup).toHaveAccessibleName("Choose a region");

  // A full reload would drop this marker; an in-app navigation keeps it.
  await page.evaluate(() => { (window as unknown as { pickerMarker: boolean }).pickerMarker = true; });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  const target = await page.locator("[aria-activedescendant]").evaluate((input) =>
    document.getElementById(input.getAttribute("aria-activedescendant")!)!.getAttribute("href"));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`${target}$`));
  await ready(page);
  expect(await page.evaluate(() => (window as unknown as { pickerMarker?: boolean }).pickerMarker)).toBe(true);
  await expect(page.getByTestId("region-picker-trigger")).toBeFocused();
  await expect(page.getByTestId("region-picker-trigger")).not.toHaveText("Imereti");
});

test("a modifier-click on a picker option opens a tab and leaves no focus jump for a later visit", async ({ page, context }) => {
  await page.goto("/en/explorer/economy/regions/imereti");
  await ready(page);
  const next = page.getByTestId("regional-entity-navigation").getByRole("link").last();
  const href = (await next.getAttribute("href"))!;
  await page.getByTestId("region-picker-trigger").click();
  const opened = context.waitForEvent("page");
  await page.getByRole("dialog").locator(`a[href="${href}"]`).click({ modifiers: ["ControlOrMeta"] });
  await (await opened).close();
  await expect(page).toHaveURL(/\/imereti$/);
  // A later in-app visit to the same page does not pull focus to its picker.
  await next.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  await ready(page);
  await expect(page.getByTestId("region-picker-trigger")).not.toBeFocused();
});

test("a region's member list and the comparison view's way back move in the app", async ({ page }) => {
  const mark = () => page.evaluate(() => { (window as unknown as { linkMarker: boolean }).linkMarker = true; });
  const marked = () => page.evaluate(() => (window as unknown as { linkMarker?: boolean }).linkMarker);

  await page.goto("/en/explorer/demography/population/region/imereti");
  await ready(page);
  await mark();
  const member = page.getByTestId("region-member-row").first();
  const href = (await member.getAttribute("href"))!;
  await member.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  await ready(page);
  expect(await marked()).toBe(true);

  await page.goto("/en/explorer/unemployment/regions#breakdown=region");
  await ready(page);
  await mark();
  await page.getByRole("link", { name: "All regions", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/unemployment\/regions$/);
  await expect(page.getByTestId("unemployment-regions-index")).toBeVisible();
  expect(await marked()).toBe(true);
});

test("the household area trigger says it opens a dialog and names it while open", async ({ page }) => {
  await page.goto("/en/explorer/living-standards/income/regions/imereti");
  await ready(page);
  const trigger = page.getByTestId("region-picker-trigger");
  await expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
  await trigger.click();
  await expect(page.locator(`#${await trigger.getAttribute("aria-controls")}`)).toHaveRole("dialog");
});

test("GDP announces the indicator and unit with the period, not the period alone", async ({ page }) => {
  await page.goto("/en/explorer/economy/gdp");
  await ready(page);
  const status = page.locator('[data-testid="gdp-indicators"] + [role="status"]');
  await page.getByTestId("gdp-tab-nominal").click();
  await expect(status).toHaveText(/^Nominal GDP · bn (GEL|USD) · Current prices · Period: \d{4}–\d{4}$/);
  await page.getByTestId("gdp-tab-per_capita").click();
  await expect(status).toHaveText(/^GDP per capita · (GEL|USD) per person · Current prices · Period: \d{4}–\d{4}$/);
});

test("heading navigation reaches the series panel and the region lists, nested under a section title", async ({ page }) => {
  await page.goto("/en/explorer/unemployment/regions/imereti");
  await ready(page);
  await expect(page.getByRole("complementary", { name: "Series" }).getByRole("heading", { level: 2, name: "Series" })).toBeAttached();

  await page.goto("/en/explorer/unemployment/regions");
  await ready(page);
  expect(await outline(page.locator("main"))).toEqual(["1:Unemployment by region", "2:Regional overview", "2:Regions"]);

  await page.goto("/en/explorer/demography/age-sex");
  await ready(page);
  const regions = page.getByTestId("age-sex-regions");
  expect(await outline(regions)).toEqual(["2:Share aged 65 and over, by region", "3:Regional overview", "3:Regions"]);
});

test("a population place page names its series column and ties each section to its title", async ({ page }) => {
  await page.goto("/en/explorer/demography/population/region/imereti");
  await ready(page);
  const aside = page.getByTestId("population-place-workspace").getByRole("complementary");
  await expect(aside).toHaveAccessibleName("Series");
  await expect(aside.getByRole("heading", { level: 2, name: "Series" })).toBeAttached();
  for (const [testId, name] of [["population-highlights", "Key indicators"], ["vital-section", "Births and deaths"], ["age-sex-section", /^Age and sex/]] as const) {
    await expect(page.getByTestId(testId)).toHaveRole("region");
    await expect(page.getByTestId(testId)).toHaveAccessibleName(name);
  }
});

test("the births-deaths map and its ranked list each sit under a heading of their own", async ({ page }) => {
  await page.goto("/en/explorer/demography/births-deaths");
  await ready(page);
  const headings = (await outline(page.locator("main"))).slice(0, 4);
  expect(headings[0]).toMatch(/^1:/);
  expect(headings.slice(1)).toEqual([
    expect.stringMatching(/^2:Municipalities by births per 100 deaths, \d{4}$/),
    "2:Key indicators",
    expect.stringMatching(/^2:Ranking by births per 100 deaths, \d{4}$/),
  ]);
});

test("the methodology archive names its year buttons, says how many sources it shows and nests the appendix", async ({ page }) => {
  await page.goto("/en/methodology/expenditure#source-archive");
  const archive = page.getByTestId("source-archive");
  await expect(archive.getByTestId("archive-year-filter")).toHaveRole("group");
  await expect(archive.getByTestId("archive-year-filter")).toHaveAccessibleName("Filter by year");
  const status = archive.getByTestId("source-archive-status");
  await expect(status).toHaveRole("status");
  const total = await archive.getByTestId("source-archive-row").count();
  await expect(status).toHaveText(`${total} of ${total} sources shown`);
  const year = archive.getByRole("button", { name: "2020", exact: true });
  await expect(async () => {
    await year.click();
    await expect(year).toHaveAttribute("aria-pressed", "true", { timeout: 1000 });
  }).toPass();
  const shown = await archive.getByTestId("source-archive-row").count();
  expect(shown).toBeLessThan(total);
  await expect(status).toHaveText(`${shown} of ${total} sources shown`);

  const appendix = page.locator('section[aria-labelledby="technical-appendix-title"]');
  const levels = await outline(appendix);
  expect(levels[0]).toBe("3:Technical appendix");
  expect(levels.length).toBeGreaterThan(1);
  for (const heading of levels.slice(1)) expect(heading).toMatch(/^4:/);

  // The English overlines over each method step are decoration; the h3 beside each names it.
  for (const label of ["PRESERVE", "READ", "APPLY", "VALIDATE"]) {
    for (const element of await page.getByText(label, { exact: true }).all()) await expect(element).toHaveAttribute("aria-hidden", "true");
  }
});

test("the about page's decorative English note is hidden from screen readers", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByTestId("mission-cover").getByText(/MISSION NOTE/)).toHaveAttribute("aria-hidden", "true");
});

test("product toggles are named once, the product table is named by its caption and the chart caption names its lines", async ({ page }) => {
  await page.goto("/en/explorer/inflation/products");
  await ready(page);
  const toggle = page.getByTestId("product-cumulative-toggle");
  await expect(toggle).toHaveAccessibleName("Cumulative price change");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAccessibleName("Cumulative price change");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();

  const row = page.getByTestId("product-table").locator("tbody tr").first();
  const name = (await row.locator("[data-original-language]").evaluate((element) => element.previousElementSibling!.textContent))!;
  await expect(row.getByTestId("product-row-toggle")).toHaveAccessibleName(name);
  await expect(row.getByTestId("product-row-toggle")).toHaveAttribute("aria-pressed", /true|false/);

  const table = page.getByTestId("product-table");
  await expect(table).toHaveRole("region");
  await expect(table).toHaveAccessibleName(/^Current products ranked by cumulative change/);
  // At 1440px the table fits: it is not a tab stop of its own.
  expect(await table.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(false);
  await expect(table).not.toHaveAttribute("tabindex");

  const selected = await page.getByTestId("series-list").locator('[data-testid="series-row-toggle"][aria-pressed="true"]')
    .getByTestId("series-label").allTextContents();
  expect(selected.length).toBeGreaterThan(0);
  // The chart's own caption names each line with its latest value; the summary does not repeat the names.
  const caption = await page.getByTestId("chart-panel").locator("figcaption li").allTextContents();
  expect(caption).toHaveLength(selected.length);
  for (const label of selected) expect(caption.some((item) => item.startsWith(`${label.trim()}, `))).toBe(true);
  await expect(page.getByTestId("product-chart-summary")).not.toContainText(selected[0]!.trim());
});

// U07-12: the sign note is the source note's first sentence; the deck under the heading states the value only.
test("the product table is still watched for a sideways scroll after the search empties and refills", async ({ page }) => {
  await page.goto("/en/explorer/inflation/products");
  await ready(page);
  const search = page.getByTestId("product-list-search");
  await search.fill("zzzzqqq");
  await expect(page.getByTestId("product-list-empty")).toBeVisible();
  await search.fill("");
  const table = page.getByTestId("product-table");
  await expect(table).not.toHaveAttribute("tabindex");
  // Make the refilled table overflow, then resize its frame so a live observer re-measures.
  await page.addStyleTag({ content: '[data-testid="product-table"] table { min-width: 3000px !important; }' });
  await page.setViewportSize({ width: 1300, height: 900 });
  await expect(table).toHaveAttribute("tabindex", "0");
});

test("the deficit deck reads its value alone", async ({ page }) => {
  await page.goto("/en/explorer/deficit");
  await ready(page);
  await expect(page.getByTestId("deficit-deck")).toHaveText(/^\d{4}: .+ · [−+]?\d\S*$/);
  await expect(page.getByTestId("source-label")).toContainText("A negative value indicates a deficit");
});

test("hub cards are named by their title, described by the rest, and the hovered footer stays readable", async ({ page }) => {
  await page.goto("/en/explorer");
  const card = page.getByTestId("hub-card").first();
  await expect(card).toHaveAccessibleName("Expenditure");
  await expect(card).toHaveAccessibleDescription(/^Expenditure by function and institution.+ · .+GEL$/);
  await card.hover();
  const footer = card.locator("p").last();
  await expect(async () => expectReadableText(footer, card)).toPass();
});

test("a debt family's members are a group named after it, which its caret controls", async ({ page }) => {
  await page.goto("/en/explorer/debt");
  await ready(page);
  const list = page.getByTestId("series-list");
  const caret = list.locator("button[aria-expanded]").first();
  if ((await caret.getAttribute("aria-expanded")) === "false") await caret.click();
  await expect(caret).toHaveAttribute("aria-expanded", "true");
  const group = page.locator(`#${await caret.getAttribute("aria-controls")}`);
  await expect(group).toHaveRole("group");
  const parent = caret.locator("xpath=.."); // the caret's own row
  await expect(group).toHaveAccessibleName((await parent.getByTestId("series-label").textContent())!.trim());
  expect(await group.getByTestId("series-row").count()).toBeGreaterThan(0);
  for (const child of await group.getByTestId("series-row").all()) await expect(child).toHaveAttribute("data-level", "debt_child");
});

test("the unemployment age heat map names its table once", async ({ page }) => {
  await page.goto("/en/explorer/unemployment/age");
  await ready(page);
  const scroller = page.getByTestId("age-heatmap-scroller");
  await expect(scroller).toHaveAccessibleName(/^Unemployment rate · % · \d{4}–\d{4}$/);
  await expect(scroller.locator("caption")).toHaveCount(0);
});

test("the services overview's two chart regions have different names", async ({ page }) => {
  await page.goto("/en/explorer/trade/services");
  await ready(page);
  await expect(page.getByTestId("chart-frame")).toHaveAccessibleName(/^Multi-year chart/);
  await expect(page.getByTestId("stack-chart-frame")).toHaveAccessibleName(/^Services balance/);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the language link's name starts with the text it shows", async ({ page }) => {
    await page.goto("/en");
    const header = page.getByTestId("landing-header");
    await header.getByRole("button", { name: "Menu", exact: true }).click();
    const link = header.getByTestId("language-switch").getByRole("link");
    // It shows "KA"; its name starts with that and goes on with the full language name.
    const shown = await link.evaluate((element) => {
      const copy = element.cloneNode(true) as HTMLElement;
      copy.querySelectorAll(".sr-only").forEach((hidden) => hidden.remove());
      element.after(copy);
      const text = copy.innerText;
      copy.remove();
      return text.trim();
    });
    expect(shown).toBe("KA");
    await expect(link).toHaveAccessibleName("KA ქართული");
    await expect(link).toHaveAttribute("lang", "ka");
  });

  test.describe("before scripts run", () => {
    test.use({ javaScriptEnabled: false });

    test("the sidebar toggle claims no open panel and no collapse action", async ({ page }) => {
      await page.goto("/explorer");
      const toggle = page.getByTestId("sidebar-toggle");
      await expect(toggle).not.toHaveAttribute("aria-expanded");
      await expect(toggle).toHaveAccessibleName("მენიუ");
    });
  });

  test("after hydration the sidebar toggle is the closed menu", async ({ page }) => {
    await page.goto("/explorer");
    const toggle = page.getByTestId("sidebar-toggle");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toHaveAccessibleName("მენიუ");
    await expect(toggle).toHaveAttribute("aria-controls", "data-sidebar-navigation");
  });
});

// axe-core, pinned in package.json, run in the page; the rules are WCAG 2.0 and 2.1, levels A and AA.
const AXE = path.join(process.cwd(), "node_modules/axe-core/axe.min.js");
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
// About's mission band numbers itself "01" in accent on ink (3.01:1). It is decorative and aria-hidden, so WCAG 1.4.3's
// incidental-text exception applies; its colour is DESIGN.md's to change, not this test's.
const DECORATIVE = ['[data-testid="mission-cover"] [aria-hidden="true"] strong'];

test("every hub, its first page and the site pages pass axe's WCAG 2.1 A and AA rules on a phone", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 375, height: 812 });
  const paths = [...NAV_TREE.flatMap(hub => [hub.href, ...(hub.sections[0] ? [hub.sections[0].href] : [])]), "/", "/methodology", "/connect", "/about"];
  const failures: string[] = [];
  for (const href of paths) {
    await page.goto(href);
    await page.addScriptTag({ path: AXE });
    const violations = await page.evaluate(async ({ tags, exclude }) => {
      const { axe } = window as unknown as { axe: { run: (context: unknown, options: unknown) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } };
      const result = await axe.run({ exclude: [exclude] }, { runOnly: { type: "tag", values: tags } });
      return result.violations.map(violation => `${violation.id}: ${violation.nodes.map(node => node.target.join(" ")).join(", ")}`);
    }, { tags: WCAG_AA, exclude: DECORATIVE });
    failures.push(...violations.map(violation => `${href} ${violation}`));
  }
  expect(failures).toEqual([]);
});
