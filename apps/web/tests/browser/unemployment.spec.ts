import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";
import { tableSeriesCount } from "./explorer-table";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

for (const prefix of ["", "/en"]) for (const width of [390, 768, 1440]) {
  test(`four unemployment cards open the matching pages ${prefix || "ka"} at ${width}px`, async ({ page }, info) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    const sections = ["overview", "regions", "age", "gender"], breakdowns = ["national", "region", "age", "sex"];
    const titles = prefix ? ["Unemployment overview", "Regions", "Age groups", "Gender"] : ["უმუშევრობის მიმოხილვა", "რეგიონები", "ასაკობრივი ჯგუფები", "სქესი"];
    for (const [index, section] of sections.entries()) {
      await page.goto(`${prefix}/explorer/unemployment`);
      await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
      const cards = page.getByTestId("unemployment-hub").getByTestId("hub-card");
      await expect(cards).toHaveCount(4);
      await expect(cards.nth(index)).toHaveAttribute("href", `${prefix}/explorer/unemployment/${section}`);
      await expect(cards.nth(index).getByRole("heading")).toHaveText(titles[index]);
      if (index === 0) await page.screenshot({ path: info.outputPath(`unemployment-hub-${prefix ? "en" : "ka"}-${width}.png`), fullPage: true });
      await cards.nth(index).click();
      await expect(page).toHaveURL(new RegExp(`${prefix}/explorer/unemployment/${section}$`));
      if (section === "regions") {
        await expect(page.getByTestId("unemployment-region-map")).toBeVisible();
        await expect(page.getByTestId("regional-list-row")).toHaveCount(11);
        await expect(page.getByTestId("chart-panel")).toHaveCount(0);
      } else await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-breakdown", breakdowns[index]);
      await expect(page.getByTestId("unemployment-headline")).toHaveCount(0);
      await expect(page.getByTestId("unemployment-breakdown")).toHaveCount(0);
      await expect(page.getByTestId("unemployment-composition")).toHaveCount(section === "overview" ? 1 : 0);
      await expect(page.getByTestId("unemployment-national-tabs")).toHaveCount(section === "overview" ? 1 : 0);
      await expect(page.getByRole("contentinfo")).toContainText(prefix ? "Geostat" : "საქსტატი");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`unemployment-${section}-${prefix ? "en" : "ka"}-${width}.png`), fullPage: true });
    }
    await page.goto(`${prefix}/explorer/unemployment/regions#breakdown=region`);
    await page.getByTestId("chart-mode-table").click();
    await page.getByTestId("series-toggle-all").click(); await page.getByTestId("series-toggle-all").click();
    await expect(page.getByTestId("series-status")).toContainText("28 / 28");
    await expect.poll(() => tableSeriesCount(page.getByTestId("explorer-table"))).toBe(28);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

for (const prefix of ["", "/en"]) for (const width of [390, 768, 1440]) {
  test(`count chart scales remain readable ${prefix || "ka"} at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${prefix}/explorer/unemployment/overview#indicator=unemployed`);
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    await page.evaluate(() => document.fonts.ready);
    const unitLabel = prefix ? "thousand persons" : "ათასი ადამიანი";
    for (const indicator of ["unemployed", "employed", "labour_force", "outside_labour_force", "population_15_plus"]) {
      await page.getByTestId("series-toggle-all").click();
      await page.locator(`[data-series-id="georgia:${indicator}"] [data-testid="series-row-toggle"]`).click();
      await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "thousand_persons");
      const labels = page.getByTestId("chart-panel").getByRole("img").locator('text[text-anchor="end"]').filter({ hasText: unitLabel });
      await expect(labels.first()).toBeVisible();
      const leftEdges = await labels.evaluateAll(nodes => nodes.map(node => (node as SVGGraphicsElement).getBBox().x));
      expect(leftEdges.length).toBeGreaterThan(0);
      expect(Math.min(...leftEdges)).toBeGreaterThanOrEqual(0);
    }
  });
}

test("national tabs keep valid metrics, coverage and reference selection", async ({ page }) => {
  await page.goto("/en/explorer/unemployment/overview"); await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  const title = await page.getByRole("heading", { level: 1 }).textContent();
  const subtitle = page.getByTestId("unemployment-explorer").locator(":scope > p").first();
  const description = await subtitle.textContent();
  for (const breakdown of ["national", "settlement", "education", "long_term"]) {
    await page.getByTestId(`unemployment-tab-${breakdown}`).click();
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-breakdown", breakdown);
    await expect(page.getByTestId(`unemployment-tab-${breakdown}`)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title!);
    await expect(subtitle).toHaveText(description!);
    await expect(page.getByTestId("unemployment-headline")).toHaveCount(0);
    await expect(page.getByTestId("source-label")).toBeVisible();
    await expect(page.getByTestId("unemployment-composition")).toHaveCount(breakdown === "national" ? 1 : 0);
    const reference = breakdown === "education" ? "georgia" : breakdown === "long_term" ? "metric.long_term_unemployment_rate" : "georgia:unemployment_rate";
    await expect(page.locator(`[data-series-id="${reference}"] [data-testid="series-row-toggle"]`)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("unemployment-indicator")).toHaveCount(0);
  }
  for (const [indicator, value] of [["long_term_unemployed", "79.4"], ["long_term_unemployment_rate", "4.9%"], ["long_term_unemployed_share", "35.5%"]]) {
    const row = page.locator(`[data-series-id="metric.${indicator}"]`);
    await row.getByTestId("series-row-toggle").click(); await expect(row).toContainText(value);
  }
  await page.getByTestId("unemployment-tab-education").click();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-indicator", "unemployment_rate");
  await expect(page.getByTestId("unemployment-indicator")).toHaveCount(0);
  await page.getByRole("button", { name: "Women", exact: true }).click();
  await expect(page.locator('[data-series-id="women"]')).toContainText("11.4%");
  await expect(page.locator('[data-series-id="women"] [data-testid="series-row-toggle"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("year-range-strip")).toContainText("2020–2025");
});

for (const prefix of ["", "/en"]) for (const width of [390, 768, 1440]) {
  test(`gender indicators expand beneath Men and Women ${prefix || "ka"} at ${width}px`, async ({ page }, info) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${prefix}/explorer/unemployment/gender`);
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    const row = (id: string) => page.locator(`[data-series-id="${id}"]`);
    const toggle = (id: string) => row(id).getByTestId("series-row-toggle");
    await expect(page.getByTestId("unemployment-indicator")).toHaveCount(0);
    await expect(page.getByTestId("series-row-toggle")).toHaveCount(3);
    await expect(toggle("georgia:unemployment_rate")).toHaveAttribute("aria-pressed", "true");
    await expect(row("georgia:unemployment_rate")).toContainText("13.9%");
    // The page opens on its comparison: Men and Women beside the national line.
    await expect(toggle("men:unemployment_rate")).toHaveAttribute("aria-pressed", "true");
    await expect(toggle("women:unemployment_rate")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("series-status")).toContainText("3 / 7");
    expect(new URL(page.url()).hash).toBe("");
    await toggle("men:unemployment_rate").click();
    await toggle("women:unemployment_rate").click();
    await expect(page.getByTestId("series-status")).toContainText("1 / 7");
    for (const group of ["men", "women"]) {
      const expand = row(`${group}:unemployment_rate`).locator("button[aria-expanded]");
      await expand.focus(); await expand.press("Space");
      await expect(expand).toHaveAttribute("aria-expanded", "true");
      await expect(page.locator(`[data-parent-id="${group}:unemployment_rate"]`)).toHaveCount(7);
      await expect(row(`${group}:employment_rate`)).toBeVisible();
    }
    await toggle("women:employment_rate").click();
    await toggle("men:participation_rate").click();
    await expect(page.getByTestId("series-status")).toContainText("3 / 7");
    await toggle("women:unemployed").click();
    await toggle("men:employed").click();
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "thousand_persons");
    await expect(toggle("georgia:unemployment_rate")).toHaveAttribute("aria-pressed", "false");
    await expect(toggle("women:employment_rate")).toHaveAttribute("aria-pressed", "false");
    await expect(toggle("men:participation_rate")).toHaveAttribute("aria-pressed", "false");
    await page.getByTestId("chart-mode-table").click();
    await page.getByTestId("range-start-handle").focus(); await page.getByTestId("range-start-handle").press("End");
    await expect.poll(() => tableSeriesCount(page.getByTestId("explorer-table"))).toBe(2);
    await expect(page.getByTestId("explorer-table")).toContainText("79.4");
    await expect(page.getByTestId("explorer-table")).toContainText("770.2");
    await page.screenshot({ path: info.outputPath(`unemployment-gender-expanded-${prefix ? "en" : "ka"}-${width}.png`), fullPage: true });
    await page.getByTestId("series-search").fill("participation");
    await page.getByTestId("series-toggle-all").click(); await page.getByTestId("series-toggle-all").click();
    await expect(page.getByTestId("series-status")).toContainText("10 / 10");
    await expect.poll(() => tableSeriesCount(page.getByTestId("explorer-table"))).toBe(10);
    await page.getByTestId("series-search").fill("");
    await toggle("women:unemployment_rate").click();
    await expect(page.getByTestId("series-status")).toContainText("1 / 7");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "percent");
    await expect(page.getByTestId("explorer-table")).toContainText("11.4%");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("gender count selections survive history, language changes and Excel download", async ({ page }) => {
  await page.goto("/en/explorer/unemployment/gender#indicator=unemployed&view=table&start=2025&end=2025&sel=women,men");
  const toggle = (id: string) => page.locator(`[data-series-id="${id}"] [data-testid="series-row-toggle"]`);
  await expect(toggle("women:unemployed")).toHaveAttribute("aria-pressed", "true");
  await expect(toggle("men:unemployed")).toHaveAttribute("aria-pressed", "true");
  await toggle("women:employed").click();
  await page.goBack(); await expect(toggle("women:employed")).toHaveAttribute("aria-pressed", "false");
  await page.goForward(); await expect(toggle("women:employed")).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "ქართული", exact: true }).click();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "thousand_persons");
  await page.reload();
  await expect(page.getByTestId("series-status")).toContainText("3 / 10");
  await expect(page.getByTestId("year-range-strip")).toContainText("2025–2025");
  const downloadPromise = page.waitForEvent("download"); await page.getByTestId("unemployment-excel-download").click();
  const download = await downloadPromise;
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await download.path())!);
  expect(workbook.worksheets).toHaveLength(3);
  expect(workbook.worksheets[0].getCell("B4").value).toBeCloseTo(144.58946215608808, 10);
  expect(workbook.worksheets[0].getCell("B5").value).toBeCloseTo(79.40887847046638, 10);
  expect(workbook.worksheets[0].getCell("B6").value).toBeCloseTo(619.47560792423394, 10);
  expect(workbook.worksheets[2].getCell("D4").value).toMatchObject({ hyperlink: "https://fiscal.ge/downloads/methodology/unemployment/files/02-labour-force-indicators-by-sex.xlsx" });
});

for (const [breakdown, group, query] of [["settlement", "urban", "Urban"], ["education", "education.higher", "Higher"]]) test(`clicking the active national tab preserves the ${breakdown} comparison`, async ({ page }) => {
  await page.goto(`/en/explorer/unemployment/overview#breakdown=${breakdown}&sel=${group}`);
  const selected = page.locator(`[data-series-id="${breakdown === "settlement" ? `${group}:unemployment_rate` : group}"] [data-testid="series-row-toggle"]`);
  await expect(selected).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("series-search").fill(query);
  const url = page.url();
  await page.getByTestId(`unemployment-tab-${breakdown}`).click();
  await expect(selected).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("series-search")).toHaveValue(query);
  expect(page.url()).toBe(url);
});

test("search does not limit age selection and the national stack survives empty overview selection", async ({ page }) => {
  await page.goto("/en/explorer/unemployment/age"); await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page.getByTestId("series-status")).toContainText("2 / 11");
  await page.getByTestId("series-search").fill("15-19");
  await page.getByTestId("series-toggle-all").click(); await expect(page.getByTestId("no-selection-callout")).toBeVisible();
  await expect(page.getByTestId("unemployment-composition")).toHaveCount(0);
  await page.getByTestId("series-toggle-all").click(); await expect(page.getByTestId("series-status")).toContainText("11 / 11");
  await page.getByTestId("series-search").fill("");
  await expect(page.getByTestId("series-list").locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(11);
  await page.getByTestId("series-toggle-all").click(); await page.reload();
  await expect(page.getByTestId("no-selection-callout")).toBeVisible();
  await page.goto("/en/explorer/unemployment/overview#sel=");
  await expect(page.getByTestId("no-selection-callout")).toBeVisible();
  await expect(page.getByTestId("unemployment-composition").getByRole("img")).toBeVisible();
});

test("history and language links preserve unit-safe indicator selections and the period", async ({ page }) => {
  await page.goto("/en/explorer/unemployment#breakdown=national&indicator=unemployment_rate&start=2021&end=2024&sel=georgia");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "percent");
  await page.getByTestId("chart-mode-table").click();
  await page.locator('[data-series-id="georgia:employed"] [data-testid="series-row-toggle"]').click();
  await page.goBack(); await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "percent");
  await page.goForward(); await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "thousand_persons");
  await page.getByRole("link", { name: "ქართული", exact: true }).click();
  await expect(page).toHaveURL(/\/explorer\/unemployment\/overview#.*sel=georgia%3Aemployed/);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "thousand_persons");
  await expect(page.getByTestId("series-status")).toContainText("1 / 7");
  await expect(page.getByTestId("year-range-strip")).toContainText("2021–2024");
  await page.reload();
  await expect(page.locator('[data-series-id="georgia:employed"] [data-testid="series-row-toggle"]')).toHaveAttribute("aria-pressed", "true");
});

test("screen table and downloaded education workbook agree and cite only the selected source", async ({ page }) => {
  await page.goto("/en/explorer/unemployment/overview#breakdown=education&sex=women&indicator=unemployment_rate&start=2025&end=2025&view=table&sel=education.higher");
  const table = page.getByTestId("explorer-table"); await expect(table).toContainText("8.9%");
  const downloadPromise = page.waitForEvent("download"); await page.getByTestId("unemployment-excel-download").click();
  const download = await downloadPromise; const file = await download.path(); expect(file).not.toBeNull();
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile(file!);
  expect(workbook.getWorksheet("Summary")!.getCell("B4").value).toBeCloseTo(0.089, 3);
  const sources = workbook.getWorksheet("Sources")!;
  expect(sources.getCell("D4").value).toMatchObject({ hyperlink: "https://fiscal.ge/downloads/methodology/unemployment/files/13-labour-force-indicators-by-education.xlsx" });
  expect(sources.rowCount).toBe(4);
});

for (const prefix of ["", "/en"]) test(`overview checkboxes never mix rates and people counts ${prefix || "ka"}`, async ({ page }) => {
  await page.setViewportSize({ width: prefix ? 1440 : 390, height: 1000 });
  await page.goto(`${prefix}/explorer/unemployment/overview`);
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  const row = (id: string) => page.locator(`[data-series-id="${id}"]`);
  const toggle = (id: string) => row(id).getByTestId("series-row-toggle");
  await expect(page.getByTestId("unemployment-indicator")).toHaveCount(0);
  await expect(row("georgia")).toHaveCount(0);
  await expect(row("georgia:employment_rate")).toHaveCount(0);
  await toggle("georgia:participation_rate").click();
  await expect(page.getByTestId("series-status")).toContainText("2 / 2");
  await toggle("georgia:employed").click();
  await expect(toggle("georgia:unemployment_rate")).toHaveAttribute("aria-pressed", "false");
  await expect(toggle("georgia:participation_rate")).toHaveAttribute("aria-pressed", "false");
  await row("georgia:employed").locator("button[aria-expanded]").click();
  await toggle("georgia:self_employed").click(); await toggle("georgia:hired").click();
  await expect(page.getByTestId("series-status")).toContainText("3 / 7");
  await expect(row("georgia:self_employed")).toContainText("426.3");
  await expect(row("georgia:hired")).toContainText("961.1");
  await toggle("georgia:unemployment_rate").click();
  for (const id of ["employed", "self_employed", "hired"]) await expect(toggle(`georgia:${id}`)).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "percent");
  await toggle("georgia:hired").click();
  await page.getByTestId("series-search").fill("self");
  await page.getByTestId("series-toggle-all").click(); await page.getByTestId("series-toggle-all").click();
  await expect(page.getByTestId("series-status")).toContainText("7 / 7");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "thousand_persons");
  await page.getByTestId("series-search").fill("");
  await expect(toggle("georgia:unemployment_rate")).toHaveAttribute("aria-pressed", "false");
  await page.getByTestId("chart-mode-table").click();
  await expect.poll(() => tableSeriesCount(page.getByTestId("explorer-table"))).toBe(7);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto(`${prefix}/explorer/unemployment/overview#sel=georgia:self_employed,georgia:hired&start=2025&end=2025&view=table`);
  await expect(page.getByTestId("explorer-table")).toContainText("426.3");
  await expect(page.getByTestId("explorer-table")).toContainText("961.1");
  const promise = page.waitForEvent("download"); await page.getByTestId("unemployment-excel-download").click();
  const download = await promise;
  expect(download.suggestedFilename()).toContain("national-people-2025-2025");
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await download.path())!);
  expect(workbook.worksheets[0].getCell("B4").value).toBeCloseTo(426.2940841069528, 10);
  expect(workbook.worksheets[0].getCell("B5").value).toBeCloseTo(961.1005993998547, 10);
  expect(workbook.worksheets[0].getCell("B5").numFmt).toBe("#,##0.0");
  expect(workbook.worksheets[2].getCell("D4").value).toMatchObject({ hyperlink: expect.stringContaining("01-labour-force-indicators.xlsx") });
});

test("settlement parents select their rates and employment subcategories select matching people counts", async ({ page }) => {
  await page.goto("/en/explorer/unemployment/overview#breakdown=settlement");
  const row = (id: string) => page.locator(`[data-series-id="${id}"]`);
  await row("urban:unemployment_rate").getByTestId("series-row-toggle").click();
  await row("urban:unemployment_rate").locator("button[aria-expanded]").click();
  await row("urban:employed").locator("button[aria-expanded]").click();
  await row("urban:hired").getByTestId("series-row-toggle").click();
  await expect(row("urban:unemployment_rate").getByTestId("series-row-toggle")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "thousand_persons");
  await row("rural:unemployment_rate").getByTestId("series-row-toggle").click();
  await expect(row("urban:hired").getByTestId("series-row-toggle")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("series-status")).toContainText("1 / 5");
  await page.getByTestId("chart-mode-table").click();
  await expect(page.getByTestId("explorer-table")).toContainText("Rural · Unemployment rate");
});

for (const prefix of ["", "/en"]) test(`long-term metric parents select Georgia and expand only to gender subcategories ${prefix || "ka"}`, async ({ page }) => {
  await page.setViewportSize({ width: prefix ? 1440 : 390, height: 1000 });
  await page.goto(`${prefix}/explorer/unemployment/overview#breakdown=long_term`);
  const row = (id: string) => page.locator(`[data-series-id="${id}"]`);
  const rate = row("metric.long_term_unemployment_rate");
  for (const indicator of ["long_term_unemployment_rate", "long_term_unemployed", "long_term_unemployed_share"]) {
    const parent = row(`metric.${indicator}`);
    await parent.locator("button[aria-expanded]").click();
    await expect(row(`georgia:${indicator}`)).toHaveCount(0);
    await expect(page.locator(`[data-parent-id="metric.${indicator}"]`)).toHaveCount(2);
    await expect(row(`men:${indicator}`)).toBeVisible();
    await expect(row(`women:${indicator}`)).toBeVisible();
    if (indicator !== "long_term_unemployment_rate") await parent.locator("button[aria-expanded]").click();
  }
  await expect(rate.getByTestId("series-row-toggle")).toHaveAttribute("aria-pressed", "true");
  await expect(rate).toContainText("4.9%");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await row("men:long_term_unemployment_rate").getByTestId("series-row-toggle").click();
  const count = row("metric.long_term_unemployed");
  await expect(count).toContainText("79.4");
  await count.getByTestId("series-row-toggle").click(); await count.locator("button[aria-expanded]").click();
  await row("men:long_term_unemployed").getByTestId("series-row-toggle").click();
  await row("women:long_term_unemployed").getByTestId("series-row-toggle").click();
  await expect(page.getByTestId("series-status")).toContainText("3 / 3");
  await expect(rate.getByTestId("series-row-toggle")).toHaveAttribute("aria-pressed", "false");
  await page.getByTestId("chart-mode-table").click();
  await expect.poll(() => tableSeriesCount(page.getByTestId("explorer-table"))).toBe(3);
  await row("metric.long_term_unemployed_share").getByTestId("series-row-toggle").click();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "percent");
  await expect(count.getByTestId("series-row-toggle")).toHaveAttribute("aria-pressed", "false");
  await rate.getByTestId("series-row-toggle").click();
  await expect.poll(() => tableSeriesCount(page.getByTestId("explorer-table"))).toBe(2);
  await expect(page.getByTestId("explorer-table")).toContainText(prefix ? "% of all unemployed" : "ყველა უმუშევრის %");
  await expect(page.getByTestId("explorer-table")).toContainText(prefix ? "% of labour force" : "შრომის ძალის %");
});

for (const prefix of ["", "/en"]) test(`national export drops the remembered education-sex label ${prefix || "ka"}`, async ({ page }) => {
  await page.goto(`${prefix}/explorer/unemployment#breakdown=education&sex=women`);
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await page.getByTestId("unemployment-tab-national").click();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-breakdown", "national");
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("unemployment-excel-download").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`fiscal-unemployment-national-unemployment_rate-2010-2025${prefix ? "-en" : ""}.xlsx`);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await download.path())!);
  expect(workbook.worksheets[0].getCell("A4").value).toBe(prefix ? "Unemployment rate" : "უმუშევრობის დონე");
  expect(workbook.worksheets[0].getCell("Q4").value).toBeCloseTo(0.139, 3);
});

for (const prefix of ["", "/en"]) test(`old shared links open the correct new page ${prefix || "ka"}`, async ({ page }) => {
  for (const [breakdown, section] of [["national", "overview"], ["region", "regions"], ["age", "age"], ["sex", "gender"], ["settlement", "overview"], ["education", "overview"], ["long_term", "overview"]]) {
    const hash = `#breakdown=${breakdown}&view=table&start=2021&end=2024&sel=`;
    await page.goto(`${prefix}/explorer/unemployment${hash}`);
    await expect(page).toHaveURL(new RegExp(`${prefix}/explorer/unemployment/${section}#`));
    expect(new URL(page.url()).hash).toBe(hash);
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-breakdown", breakdown);
    await expect(page.getByTestId("no-selection-callout")).toBeVisible();
    await expect(page.getByTestId("year-range-strip")).toContainText("2021–2024");
  }
  await page.goto(`${prefix}/explorer/unemployment#sources`);
  await expect(page.getByTestId("unemployment-hub")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${prefix}/explorer/unemployment#sources$`));
});

for (const prefix of ["", "/en"]) for (const [section, group, display, value, source] of [
  ["regions", "region.tbilisi", "17.5%", 0.1745742771624716, "05-labour-force-indicators-by-region.xlsx"],
  ["age", "age.15_19", "39.0%", 0.39012631505195714, "04-labour-force-indicators-by-age.xlsx"],
  ["gender", "women", "11.4%", 0.11362232245289762, "02-labour-force-indicators-by-sex.xlsx"],
] as const) test(`${section} table and download use the selected group ${prefix || "ka"}`, async ({ page }) => {
  await page.goto(`${prefix}/explorer/unemployment/${section}#view=table&start=2025&end=2025&sel=${group}`);
  await expect(page.getByTestId("explorer-table")).toContainText(display);
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("unemployment-excel-download").click();
  const download = await downloadPromise;
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await download.path())!);
  expect(workbook.worksheets).toHaveLength(3);
  expect(workbook.worksheets[0].getCell("B4").value).toBeCloseTo(value, 10);
  expect(workbook.worksheets[2].getCell("D4").value).toMatchObject({ hyperlink: expect.stringContaining(source) });
});

for (const prefix of ["", "/en"]) test(`new controls and year handles work with the keyboard ${prefix || "ka"}`, async ({ page }) => {
  await page.goto(`${prefix}/explorer/unemployment/overview`); await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  const longTerm = page.getByTestId("unemployment-tab-long_term"); await longTerm.focus(); await longTerm.press("Space");
  await expect(longTerm).toHaveAttribute("aria-pressed", "true");
  const indicator = page.locator('[data-series-id="metric.long_term_unemployed"] [data-testid="series-row-toggle"]'); await indicator.focus(); await indicator.press("Space");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-indicator", "long_term_unemployed");
  await expect(page.locator('[data-series-id="metric.long_term_unemployed"]')).toContainText("79.4");
  const start = page.getByTestId("range-start-handle"); await start.focus(); await start.press("ArrowRight");
  await expect(start).toHaveAttribute("aria-valuenow", "2021");
  await page.getByTestId("chart-mode-table").focus(); await page.getByTestId("chart-mode-table").press("Space");
  await expect(page.getByTestId("explorer-table")).toBeVisible();
});

test("both methodology pages link nine byte-identical originals without a nonexistent bulk dataset", async ({ page, request }) => {
  const root = path.resolve(process.cwd(), "../..");
  const manifest = JSON.parse(await readFile(path.join(root, "docs/Raw Data/Unemployment/geostat-labour-force-annual/source-manifest.json"), "utf8")) as { local_file: string; sha256: string }[];
  for (const prefix of ["", "/en"]) {
    await page.goto(`${prefix}/methodology/unemployment`);
    await expect(page.locator('a[href^="/downloads/methodology/unemployment/files/"]')).toHaveCount(9);
    await expect(page.getByTestId("processed-dataset-download")).toHaveCount(0);
  }
  for (const source of manifest) {
    const response = await request.get(`/downloads/methodology/unemployment/files/${path.posix.basename(source.local_file)}`);
    expect(response.ok()).toBe(true);
    expect(createHash("sha256").update(await response.body()).digest("hex")).toBe(source.sha256.toLowerCase());
  }
});
