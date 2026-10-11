import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";

const pressed = (id: string) => `[data-series-id="${id}"] [data-testid="series-row-toggle"]`;
const SECTIONS = ["supply", "loans-deposits", "interest-rates", "bank-health"];
/** The initial count of each page: its first series, or both totals on Loans and deposits. */
const INITIAL_COUNT: Record<string, string> = { "supply": "1 / 4", "loans-deposits": "2 / 4", "interest-rates": "1 / 3", "bank-health": "1 / 5" };

/** The table cell of the row labelled `label` in the `year` column (the wide, year-columns layout). */
async function cell(page: Page, label: string, year: number) {
  const table = page.getByTestId("explorer-table");
  const column = (await table.locator("thead th").allInnerTexts()).findIndex(text => text.trim().startsWith(String(year)));
  expect(column).toBeGreaterThan(0);
  return table.locator("tbody tr", { hasText: label }).locator("td").nth(column);
}

for (const prefix of ["", "/en"]) for (const width of [390, 768, 1440]) {
  test(`money and banks hub and pages render ${prefix || "ka"} at ${width}px`, async ({ page }) => {
    test.setTimeout(90_000);
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${prefix}/explorer/money`);
    const hub = page.getByTestId("money-hub");
    await expect(hub.locator("a")).toHaveCount(4);
    expect(await hub.locator("a").evaluateAll(links => links.map(link => link.getAttribute("href")))).toEqual(SECTIONS.map(section => `${prefix}/explorer/money/${section}`));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const section of SECTIONS) {
      await page.goto(`${prefix}/explorer/money/${section}`);
      await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
      await expect(page.getByTestId("series-status")).toContainText(INITIAL_COUNT[section]);
      // No money page has a tab row: two of them switch measures with icons on the chart toolbar.
      await expect(page.getByTestId("money-tabs")).toHaveCount(0);
      await expect(page.locator('[data-testid^="money-measure-"]')).toHaveCount(section === "supply" || section === "loans-deposits" ? 2 : 0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}

test("money supply has no tabs and defaults to the amounts with broad money alone", async ({ page }) => {
  await page.goto("/explorer/money/supply");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page.getByTestId("money-latest")).toContainText("57.7");
  await expect(page.getByTestId("money-tabs")).toHaveCount(0);
  // The icon switch: ₾ for the amounts, a pie for % of GDP, each named for screen readers and in its tooltip.
  const measures = page.getByRole("group", { name: "მაჩვენებელი" });
  await expect(measures.getByRole("button", { name: "მოცულობა" })).toHaveAttribute("aria-pressed", "true");
  await expect(measures.getByRole("button", { name: "მშპ-სთან შეფარდებით" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("money-measure-amount")).toHaveText("₾");
  await expect(page.getByTestId("money-measure-gdp").locator("svg.lucide-chart-pie")).toHaveCount(1);
  await expect(page.getByTestId("money-unit-label")).toBeVisible();
  await expect(page.getByTestId("series-status")).toContainText("1 / 4");
  await expect(page.locator(pressed("money.m3"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(`[data-testid="series-row-toggle"][aria-pressed="true"]`)).toHaveCount(1);
  await expect(page.getByTestId("year-range-strip")).toContainText("1995–2025");
  await expect(page.getByTestId("source-label")).toContainText("საქართველოს ეროვნული ბანკი");
});

test("the % of GDP icon shows NBG's ratios, carries M3 and M2 across and drops M1", async ({ page }) => {
  await page.goto("/en/explorer/money/supply");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page.getByRole("group", { name: "Measure" }).getByRole("button", { name: "Compared with GDP" })).toBeVisible();
  await page.locator(pressed("money.m2")).click();
  await page.locator(pressed("money.m1")).click();
  await page.getByRole("button", { name: "Compared with GDP" }).click();
  await expect(page.getByTestId("money-measure-gdp")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("money-measure-amount")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "percent");
  // The icon carries no text, so the unit caption beside it stays and names the percent.
  await expect(page.getByTestId("money-unit-label")).toHaveText("%");
  // Touch readers get no tooltip: the line under the heading names the selected measure.
  await expect(page.getByTestId("money-latest")).toHaveText("Broad money (M3) to GDP · 2025: 56.0%");
  await expect(page.getByTestId("series-status")).toContainText("2 / 2");
  for (const id of ["money.m3_to_gdp", "money.m2_to_gdp"]) await expect(page.locator(pressed(id))).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/tab=gdp/);
  await expect(page.getByTestId("year-range-strip")).toContainText("1996–2025");
  await page.getByTestId("money-measure-amount").click();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "gel");
  await expect(page.getByTestId("money-unit-label")).toHaveText("bn GEL");
  await expect(page.getByTestId("money-latest")).toContainText("Broad money (M3) · 2025: 57.7");
  for (const id of ["money.m3", "money.m2"]) await expect(page.locator(pressed(id))).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(`[data-testid="series-row-toggle"][aria-pressed="true"]`)).toHaveCount(2);
});

test("company deposits before 2015 are a dash, not zero", async ({ page }) => {
  await page.goto("/en/explorer/money/loans-deposits");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page.getByTestId("series-status")).toContainText("2 / 4");
  await page.locator(pressed("deposits.legal_entities")).click();
  await page.getByTestId("chart-mode-table").click();
  await expect(await cell(page, "Deposits of companies", 2014)).toHaveText("—");
  await expect(await cell(page, "Deposits of companies", 2015)).not.toHaveText("—");
  await expect(await cell(page, "All deposits", 2014)).not.toHaveText("—");
});

test("loans and deposits has no tabs, both totals selected and their parts nested", async ({ page }) => {
  await page.goto("/explorer/money/loans-deposits");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page.getByTestId("money-tabs")).toHaveCount(0);
  await expect(page.getByTestId("money-measure-amount")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("series-status")).toContainText("2 / 4");
  for (const id of ["loans.total", "deposits.total"]) await expect(page.locator(pressed(id))).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(`[data-testid="series-row-toggle"][aria-pressed="true"]`)).toHaveCount(2);
  // Eight rows are read at a glance: the shared selector shows no search field below eleven.
  await expect(page.getByTestId("series-search")).toHaveCount(0);
  await page.locator('[data-series-id="loans.total"] [aria-expanded]').click();
  await expect(page.locator('[data-series-id="loans.gel"]')).toContainText("ლარ");
  await page.locator(pressed("loans.gel")).click();
  await expect(page.getByTestId("series-status")).toContainText("2 / 4");
  await expect(page).toHaveURL(/sel=loans\.total(%2C|,)loans\.gel(%2C|,)deposits\.total(&|$)/);
});

test("the foreign-currency icon carries loans and deposits to their shares and back to the totals", async ({ page }) => {
  await page.goto("/en/explorer/money/loans-deposits");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  const measures = page.getByRole("group", { name: "Measure" });
  await expect(measures.getByRole("button", { name: "Amount" })).toHaveAttribute("aria-pressed", "true");
  const share = measures.getByRole("button", { name: "Share in foreign currency" });
  await expect(share).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("money-measure-fx_share").locator("svg.lucide-circle-dollar-sign")).toHaveCount(1);
  // Only deposits selected: people's deposits carry to the deposits share.
  await page.locator(pressed("loans.total")).click();
  await page.locator(pressed("deposits.total")).click();
  await page.locator(pressed("deposits.individuals")).click();
  await share.click();
  await expect(share).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/tab=fx_share/);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "percent");
  await expect(page.getByTestId("money-latest")).toHaveText("Share of loans in foreign currency · 2025: 41.9%");
  await expect(page.locator(pressed("deposits.fx_share"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(`[data-testid="series-row-toggle"][aria-pressed="true"]`)).toHaveCount(1);
  // The hash key and the Excel filename keep the view's id.
  const promise = page.waitForEvent("download"); await page.getByTestId("money-excel-download").click();
  expect((await promise).suggestedFilename()).toContain("money-loans-deposits-fx_share-");
  await page.locator(pressed("loans.fx_share")).click();
  await measures.getByRole("button", { name: "Amount" }).click();
  await expect(page).toHaveURL(/tab=amount/);
  for (const id of ["loans.total", "deposits.total"]) await expect(page.locator(pressed(id))).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(`[data-testid="series-row-toggle"][aria-pressed="true"]`)).toHaveCount(2);
  await expect(page.getByTestId("money-latest")).toContainText("Bank loans · 2025:");
});

test("the National Bank rate has no tabs, two decimals and a gap before 2008", async ({ page }) => {
  await page.goto("/en/explorer/money/interest-rates#view=table");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page.getByTestId("money-tabs")).toHaveCount(0);
  await expect(page.getByTestId("money-latest")).toContainText("8.00");
  await expect(page.getByTestId("year-range-strip")).toContainText("1996–2025");
  await expect(await cell(page, "National Bank rate", 2025)).toHaveText("8.00%");
  await expect(await cell(page, "National Bank rate", 2007)).toHaveText("—");
});

test("bank health has one list, a dash for capital before 2014 and the 2008 losses below zero", async ({ page }) => {
  await page.goto("/en/explorer/money/bank-health");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page.getByTestId("money-latest")).toContainText("2.5%");
  await expect(page.getByTestId("money-tabs")).toHaveCount(0);
  await expect(page.getByTestId("year-range-strip")).toContainText("2001–2025");
  await expect(page.getByTestId("series-status")).toContainText("1 / 5");
  await page.locator(pressed("banks.roa")).click();
  await page.locator(pressed("banks.roe")).click();
  // The axis runs below zero for the 2008 losses.
  await expect(page.getByTestId("chart-panel").locator("svg text", { hasText: /^−/ }).first()).toBeAttached();
  await page.locator(pressed("banks.capital_ratio")).click();
  await page.getByTestId("chart-mode-table").click();
  await expect(await cell(page, "Capital to risk-weighted assets", 2013)).toHaveText("—");
  await expect(await cell(page, "Capital to risk-weighted assets", 2014)).not.toHaveText("—");
  await expect(await cell(page, "Return on assets", 2008)).toHaveText("−2.5%");
  await expect(await cell(page, "Return on equity", 2008)).toHaveText("−12.6%");
});

test("the Excel download keeps the 2008 loss as a negative number", async ({ page }) => {
  await page.goto("/en/explorer/money/bank-health#view=table&sel=banks.roa,banks.roe&start=2008&end=2010");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  const promise = page.waitForEvent("download"); await page.getByTestId("money-excel-download").click();
  const download = await promise;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await download.path())!);
  expect(workbook.worksheets).toHaveLength(3);
  const values: unknown[] = [];
  workbook.worksheets[0].eachRow(row => row.eachCell(entry => { values.push(entry.value); }));
  expect(values).toContain(-2.5);
});

const SAVED: Record<string, { hash: string; measure?: string; selected: string[]; range: string }> = {
  "supply": { hash: "tab=gdp&view=table&sel=money.m3_to_gdp%2Cmoney.m2_to_gdp&start=2000&end=2020", measure: "gdp", selected: ["money.m3_to_gdp", "money.m2_to_gdp"], range: "2000–2020" },
  "loans-deposits": { hash: "tab=fx_share&view=table&sel=deposits.fx_share&start=2005&end=2015", measure: "fx_share", selected: ["deposits.fx_share"], range: "2005–2015" },
  "interest-rates": { hash: "view=table&sel=rates.policy%2Crates.loans_gel&start=2010&end=2020", selected: ["rates.policy", "rates.loans_gel"], range: "2010–2020" },
  "bank-health": { hash: "view=table&sel=banks.tier1_ratio&start=2016&end=2024", selected: ["banks.tier1_ratio"], range: "2016–2024" },
};

for (const section of SECTIONS) {
  test(`the language switch keeps tab, range, selection and mode on ${section}`, async ({ page }) => {
    const saved = SAVED[section];
    // The open section list puts the sidebar's language link below a 720px fold, as on the budget pages.
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto(`/explorer/money/${section}#${saved.hash}`);
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    await page.getByTestId("language-switch").getByRole("link", { name: "English", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/en/explorer/money/${section}#`));
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    if (saved.measure) await expect(page.getByTestId(`money-measure-${saved.measure}`)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
    await expect(page.getByTestId("year-range-strip")).toContainText(saved.range);
    for (const id of saved.selected) await expect(page.locator(pressed(id))).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(`[data-testid="series-row-toggle"][aria-pressed="true"]`)).toHaveCount(saved.selected.length);
  });
}
