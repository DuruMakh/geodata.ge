import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import { tableSeriesCount } from "./explorer-table";
import { topicCards } from "./group-cards";

for (const prefix of ["", "/en"]) for (const width of [390, 768, 1440]) {
  test(`Trade hub and Overview compare four indicators ${prefix || "ka"} at ${width}px`, async ({ page }) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    // The old Trade hub is the section #t-trade of the External sector page now.
    await page.goto(`${prefix}/explorer/external`);
    const card = topicCards(page, "trade");
    await expect(card).toHaveCount(6); await card.first().click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/explorer/trade/overview$`));
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    await page.evaluate(() => document.fonts.ready);
    const toggle = (id: string) => page.locator(`[data-series-id="${id}"]`).getByTestId("series-row-toggle");
    await expect(toggle("trade.turnover")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("series-status")).toContainText("1 / 4");
    await expect(page.getByTestId("trade-summary")).toHaveAttribute("data-end-year", "2025");
    await expect(page.getByTestId("trade-balance-context").getByRole("img").getByText("1995", { exact: true })).toHaveCount(1);
    await expect(page.getByTestId("trade-balance-context").getByRole("img").getByText("2025", { exact: true })).toHaveCount(1);
    await expect(page.getByTestId("trade-summary").locator('[data-indicator="trade.balance"]')).toContainText("−11.4");
    // The selection flow below is width-independent; 768 (the layout threshold) keeps the defaults and the overflow check.
    if (width === 768) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(errors).toEqual([]);
      return;
    }
    await page.getByTestId("series-toggle-all").click(); await page.getByTestId("series-toggle-all").click();
    await expect(page.getByTestId("series-status")).toContainText("4 / 4");
    await toggle("trade.turnover").click();
    await page.getByTestId("chart-mode-table").click();
    // Phones list years as rows (owner decision D5), so count series in either layout.
    await expect.poll(() => tableSeriesCount(page.getByTestId("explorer-table"))).toBe(3);
    await expect(page.getByTestId("trade-balance-context")).toBeVisible();
    // Four rows are read at a glance: no search field (DESIGN §7.7, U21-09).
    await expect(page.getByTestId("series-search")).toHaveCount(0);
    await page.getByTestId("series-toggle-all").click();
    await expect(page.getByTestId("series-status")).toContainText("0 / 4");
    await page.getByTestId("series-toggle-all").click();
    await expect(page.getByTestId("series-status")).toContainText("4 / 4");
    await page.getByTestId("series-toggle-all").click();
    await expect(page.getByTestId("no-selection-callout")).toBeVisible();
    await expect(page.getByTestId("trade-balance-context")).toBeVisible();
    await expect(page.getByTestId("trade-summary")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("series-status")).toContainText("0 / 4");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("empty selection, range and mode survive keyboard changes, reload, language and history", async ({ page }) => {
  await page.goto("/en/explorer/trade/overview#view=table&sel=&start=2023&end=2025");
  await expect(page.getByTestId("series-status")).toContainText("0 / 4");
  const end = page.getByTestId("range-end-handle");
  await end.focus(); await end.press("ArrowLeft");
  await expect(end).toHaveAttribute("aria-valuenow", "2024");
  await expect(page.getByTestId("trade-summary")).toHaveAttribute("data-end-year", "2024");
  await page.getByTestId("data-sidebar").getByRole("link", { name: "ქართული", exact: true }).click();
  await expect(page).toHaveURL(/\/explorer\/trade\/overview#/);
  await expect(page.getByTestId("series-status")).toContainText("0 / 4");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  await expect(page.getByTestId("trade-summary")).toHaveAttribute("data-end-year", "2024");
  const exports = page.locator('[data-series-id="trade.exports"]').getByTestId("series-row-toggle");
  await exports.focus(); await exports.press("Space");
  await expect(exports).toHaveAttribute("aria-pressed", "true");
  await page.goBack(); await expect(page.getByTestId("series-status")).toContainText("0 / 4");
  await page.goForward(); await expect(page.getByTestId("series-status")).toContainText("1 / 4");
});

test("downloaded Excel matches selected USD figures, publication status and the verified source", async ({ page, request }) => {
  await page.goto("/en/explorer/trade/overview#view=table&sel=trade.exports,trade.balance&start=2025&end=2025");
  await expect(page.getByTestId("series-status")).toContainText("2 / 4");
  const downloaded = page.waitForEvent("download");
  await page.getByTestId("trade-excel-download").click();
  const download = await downloaded, file = await download.path();
  expect(download.suggestedFilename()).toBe("fiscal-trade-overview-2025-2025-en.xlsx");
  const excel = new ExcelJS.Workbook(); await excel.xlsx.readFile(file!);
  expect(excel.worksheets.map(sheet => sheet.name)).toEqual(["Summary", "Data", "Sources"]);
  const data = excel.getWorksheet("Data")!;
  expect(data.getCell("D1").value).toBe("Amount (USD)");
  expect(data.getCell("D2").value).toBeCloseTo(7287805027.574291, 5);
  expect(data.getCell("D3").value).toBeCloseTo(-11360708279.612498, 5);
  expect(data.getCell("F2").value).toBe("Unspecified");
  expect(data.getCell("D3").numFmt).not.toContain("Red");
  const link = excel.getWorksheet("Sources")!.getCell("D4").value;
  expect(link).toMatchObject({ hyperlink: "https://fiscal.ge/downloads/methodology/trade/files/ftrade_1995-2026.xlsx" });
  const source = await request.get("/downloads/methodology/trade/files/ftrade_1995-2026.xlsx");
  expect(source.ok()).toBe(true);
  expect(createHash("sha256").update(await source.body()).digest("hex")).toBe("8eaaa8bf93e3d68d647f7b34857049b6e672924cb4dbf71573db1f173d2cd4ce");
});

for (const prefix of ["", "/en"]) {
  // The methodology page's own archive, JSON-LD and validation report are checked in methodology.spec.ts.
  test(`Trade Overview navigation reaches its methodology ${prefix || "ka"}`, async ({ page }) => {
    await page.goto(`${prefix}/explorer/trade/overview`);
    await expect(page.getByTestId("trade-overview-link")).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("contentinfo")).toHaveCount(0);
    await page.getByTestId("source-label").getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/methodology/trade$`));
  });
}
for (const { prefix, width, selection } of [
  { prefix: "", width: 1440, selection: "trade.exports,trade.balance" },
  { prefix: "/en", width: 1440, selection: "trade.exports,trade.balance" },
  { prefix: "", width: 390, selection: "" },
  { prefix: "/en", width: 390, selection: "" },
]) {
  test('active Overview navigation preserves the saved view ' + (prefix || "ka") + ' at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(prefix + "/explorer/trade/overview#view=table&sel=" + selection + "&start=2023&end=2024");
    const expectView = async () => {
      await expect(page.getByTestId("series-status")).toContainText(selection ? "2 / 4" : "0 / 4");
      await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
      await expect(page.getByTestId("range-start-handle")).toHaveAttribute("aria-valuenow", "2023");
      await expect(page.getByTestId("range-end-handle")).toHaveAttribute("aria-valuenow", "2024");
    };
    await expectView();
    const before = page.url();
    if (width < 900) await page.getByTestId("sidebar-menu-button").click();
    await page.getByTestId("trade-overview-link").click();
    await expect(page).toHaveURL(before);
    if (width < 900) await expect(page.getByTestId("sidebar-menu-button")).toHaveAttribute("aria-expanded", "false");
    await page.reload();
    await expectView();
    if (width < 900) await page.getByTestId("sidebar-menu-button").click();
    await page.getByTestId("data-sidebar").getByRole("link", { name: prefix ? "ქართული" : "English", exact: true }).click();
    await expect(page).toHaveURL(new RegExp((prefix ? "" : "/en") + "/explorer/trade/overview#"));
    await expectView();
    expect(new URLSearchParams(new URL(page.url()).hash.slice(1)).get("sel")).toBe(selection);
  });
}

test("encoded HTML source aliases cannot execute from the site origin", async ({ request }) => {
  for (const href of [
    "/downloads/methodology/trade/files/external_trade_methodology.html",
    "/downloads/methodology/trade/files/metadata-en.html",
    "/downloads/methodology/trade/files/%65xternal_trade_methodology.html",
    "/downloads/methodology/%74rade/files/external_trade_methodology.html",
    "/downloads/methodology/trade/%66iles/metadata-en.html",
    "/downloads/methodology/trade/files/metadata-en%2ehtml",
    "/downloads/methodology/trade/files/metadata-en%2e%68%74%6d%6c",
  ]) {
    const response = await request.get(href);
    expect(response.status(), href).toBe(404);
  }
  for (const [href, hash] of [
    ["/downloads/methodology/trade/files/%65xternal_trade_methodology.html.txt", "8f912e38ceac487c9a80205b80e1c5de043de5cc2c753adf5b98f9b8b8c3d0b4"],
    ["/downloads/methodology/%74rade/files/external_trade_methodology.html.txt", "8f912e38ceac487c9a80205b80e1c5de043de5cc2c753adf5b98f9b8b8c3d0b4"],
    ["/%64ownloads/methodology/trade/files/external_trade_methodology.html.txt", "8f912e38ceac487c9a80205b80e1c5de043de5cc2c753adf5b98f9b8b8c3d0b4"],
    ["/downloads/%6dethodology/trade/files/metadata-en.html.txt", "4b6e3d4ed9340b75800ebbfcf880625527ec2bda0f3c1d76b14702806bed6114"],
    ["/downloads/methodology/trade/%66iles/metadata-en.html.txt", "4b6e3d4ed9340b75800ebbfcf880625527ec2bda0f3c1d76b14702806bed6114"],
    ["/downloads/methodology/trade/files/metadata-en%2ehtml%2etxt", "4b6e3d4ed9340b75800ebbfcf880625527ec2bda0f3c1d76b14702806bed6114"],
    ["/downloads/methodology/trade/files/metadata-en.html.%74%78%74", "4b6e3d4ed9340b75800ebbfcf880625527ec2bda0f3c1d76b14702806bed6114"],
  ]) {
    const response = await request.get(href);
    expect(response.status(), href).toBe(200);
    expect(response.headers()["content-type"], href).toMatch(/^text\/plain\b/);
    expect(response.headers()["x-content-type-options"], href).toBe("nosniff");
    expect(createHash("sha256").update(await response.body()).digest("hex"), href).toBe(hash);
  }
});
