import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

for (const prefix of ["", "/en"]) for (const width of [390, 768, 1440]) {
  test(`unemployment defaults, controls and composition fit ${prefix || "ka"} at ${width}px`, async ({ page }, info) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 }); await page.goto(`${prefix}/explorer/unemployment`);
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    await expect(page.getByTestId("unemployment-headline")).toContainText("13.9%");
    await expect(page.getByTestId("series-status")).toContainText("1 / 1");
    await expect(page.getByTestId("chart-panel").getByRole("img").locator('path[stroke="#1E1B16"]')).toHaveCount(1);
    await expect(page.getByTestId("unemployment-composition").getByRole("img")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toContainText(prefix ? "Geostat" : "საქსტატი");
    await page.getByTestId("unemployment-breakdown").selectOption("region");
    await page.getByTestId("chart-mode-table").click();
    await page.getByTestId("series-toggle-all").click(); await page.getByTestId("series-toggle-all").click();
    await expect(page.getByTestId("series-status")).toContainText("14 / 14");
    await expect(page.getByTestId("explorer-table").locator("tbody tr")).toHaveCount(14);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`unemployment-${prefix ? "en" : "ka"}-${width}.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}

test("breakdown and indicator controls keep valid metrics, coverage and reference selection", async ({ page }) => {
  await page.goto("/en/explorer/unemployment"); await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  for (const breakdown of ["national", "sex", "settlement", "age", "region", "education", "long_term"]) {
    await page.getByTestId("unemployment-breakdown").selectOption(breakdown);
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-breakdown", breakdown);
    await expect(page.locator('[data-series-id="georgia"] [data-testid="series-row-toggle"]')).toHaveAttribute("aria-pressed", "true");
  }
  for (const [indicator, value] of [["long_term_unemployed", "79.4"], ["long_term_unemployment_rate", "4.9%"], ["long_term_unemployed_share", "35.5%"]]) {
    await page.getByTestId("unemployment-indicator").selectOption(indicator); await expect(page.getByTestId("unemployment-headline")).toContainText(value);
  }
  await page.getByTestId("unemployment-breakdown").selectOption("education");
  await expect(page.getByTestId("unemployment-indicator")).toHaveValue("unemployment_rate");
  await expect(page.getByTestId("unemployment-indicator").locator("option")).toHaveCount(3);
  await page.getByRole("button", { name: "Women", exact: true }).click();
  await expect(page.getByTestId("unemployment-headline")).toContainText("11.4%");
  await expect(page.locator('[data-series-id="women"] [data-testid="series-row-toggle"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("year-range-strip")).toContainText("2020–2025");
});

test("search does not limit bulk selection and the national stack survives empty main selection", async ({ page }) => {
  await page.goto("/en/explorer/unemployment#breakdown=age"); await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page.getByTestId("series-status")).toContainText("1 / 17");
  await page.getByTestId("series-search").fill("15-19");
  await page.getByTestId("series-toggle-all").click(); await expect(page.getByTestId("no-selection-callout")).toBeVisible();
  await expect(page.getByTestId("unemployment-composition").getByRole("img")).toBeVisible();
  await page.getByTestId("series-toggle-all").click(); await expect(page.getByTestId("series-status")).toContainText("17 / 17");
  await page.getByTestId("series-search").fill("");
  await expect(page.getByTestId("series-list").locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(17);
  await page.getByTestId("series-toggle-all").click(); await page.reload();
  await expect(page.getByTestId("no-selection-callout")).toBeVisible();
});

test("history and language links preserve the indicator, period, education sex and selection", async ({ page }) => {
  await page.goto("/en/explorer/unemployment#breakdown=education&sex=women&indicator=employment_rate&start=2021&end=2024&sel=education.higher");
  await expect(page.getByTestId("unemployment-indicator")).toHaveValue("employment_rate");
  await page.getByTestId("chart-mode-table").click(); await page.getByTestId("unemployment-indicator").selectOption("participation_rate");
  await page.goBack(); await expect(page.getByTestId("unemployment-indicator")).toHaveValue("employment_rate");
  await page.goForward(); await expect(page.getByTestId("unemployment-indicator")).toHaveValue("participation_rate");
  await page.getByRole("link", { name: "ქართული", exact: true }).click();
  await expect(page).toHaveURL(/\/explorer\/unemployment#.*sex=women/);
  await expect(page.getByTestId("unemployment-indicator")).toHaveValue("participation_rate");
  await expect(page.getByTestId("series-status")).toContainText("1 / 5");
  await expect(page.getByTestId("year-range-strip")).toContainText("2021–2024");
});

test("screen table and downloaded education workbook agree and cite only the selected source", async ({ page }) => {
  await page.goto("/en/explorer/unemployment#breakdown=education&sex=women&indicator=unemployment_rate&start=2025&end=2025&view=table&sel=education.higher");
  const table = page.getByTestId("explorer-table"); await expect(table).toContainText("8.9%");
  const downloadPromise = page.waitForEvent("download"); await page.getByTestId("unemployment-excel-download").click();
  const download = await downloadPromise; const file = await download.path(); expect(file).not.toBeNull();
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile(file!);
  expect(workbook.getWorksheet("Summary")!.getCell("B4").value).toBeCloseTo(0.089, 3);
  const sources = workbook.getWorksheet("Sources")!;
  expect(sources.getCell("D4").value).toMatchObject({ hyperlink: "https://fiscal.ge/downloads/methodology/unemployment/files/13-labour-force-indicators-by-education.xlsx" });
  expect(sources.rowCount).toBe(4);
});

for (const prefix of ["", "/en"]) test(`new controls and year handles work with the keyboard ${prefix || "ka"}`, async ({ page }) => {
  await page.goto(`${prefix}/explorer/unemployment`); await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  const breakdown = page.getByTestId("unemployment-breakdown"); await breakdown.focus(); await breakdown.press("End");
  await expect(breakdown).toHaveValue("long_term");
  const indicator = page.getByTestId("unemployment-indicator"); await indicator.focus(); await indicator.press("ArrowDown");
  await expect(indicator).toHaveValue("long_term_unemployed");
  await expect(page.getByTestId("unemployment-headline")).toContainText("79.4");
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
