import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import { moneyBanksViewSeries, type MoneyBanksSectionId } from "../../lib/explorer/moneyBanks";
import { loadMoneyBanksCsv, yearSpan } from "../helpers/money-banks-csv";

const pressed = (id: string) => `[data-series-id="${id}"] [data-testid="series-row-toggle"]`;
const SECTIONS = ["supply", "loans-deposits", "interest-rates", "bank-health"];
/** The initial count of each page: its first series, or both totals on Loans and deposits. */
const INITIAL_COUNT: Record<string, string> = { "supply": "1 / 4", "loans-deposits": "2 / 4", "interest-rates": "1 / 3", "bank-health": "1 / 5" };

// Latest values and year spans come from the reviewed CSV, so an NBG refresh does not fail these tests.
let csv: Awaited<ReturnType<typeof loadMoneyBanksCsv>>;
test.beforeAll(async () => { csv = await loadMoneyBanksCsv(); });
/** The ids a page lists in one of its views. */
const seriesOf = (section: MoneyBanksSectionId, view: Parameters<typeof moneyBanksViewSeries>[1]) => moneyBanksViewSeries(section, view).map(series => series.id);

/** The table cell of the row labelled `label` in the `year` column (the wide, year-columns layout). */
async function cell(page: Page, label: string, year: number) {
  const table = page.getByTestId("explorer-table");
  const column = (await table.locator("thead th").allInnerTexts()).findIndex(text => text.trim().startsWith(String(year)));
  expect(column).toBeGreaterThan(0);
  // The row label is the row's <th>, so value cells start one column earlier.
  return table.locator("tbody tr", { hasText: label }).locator("td").nth(column - 1);
}

// Structure once per locale; page overflow at 390, 768 and 1440px is in the layout pass of mobile-fit-charts.spec.ts.
for (const prefix of ["", "/en"]) {
  test(`money and banks hub and pages render ${prefix || "ka"}`, async ({ page }) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${prefix}/explorer/money`);
    const hub = page.getByTestId("money-hub");
    await expect(hub.locator("a")).toHaveCount(4);
    expect(await hub.locator("a").evaluateAll(links => links.map(link => link.getAttribute("href")))).toEqual(SECTIONS.map(section => `${prefix}/explorer/money/${section}`));
    for (const section of SECTIONS) {
      await page.goto(`${prefix}/explorer/money/${section}`);
      await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
      await expect(page.getByTestId("series-status")).toContainText(INITIAL_COUNT[section]);
      // No money page has a tab row: two of them switch measures with icons on the chart toolbar.
      await expect(page.getByTestId("money-tabs")).toHaveCount(0);
      await expect(page.locator('[data-testid^="money-measure-"]')).toHaveCount(section === "supply" || section === "loans-deposits" ? 2 : 0);
    }
    expect(errors).toEqual([]);
  });
}

test("money supply has no tabs and defaults to the amounts with broad money alone", async ({ page }) => {
  await page.goto("/explorer/money/supply");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  const latest = csv.latestYear("money.m3");
  await expect(page.getByTestId("money-latest")).toContainText(`${latest}: ${csv.billions("money.m3", latest)}`);
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
  await expect(page.getByTestId("year-range-strip")).toContainText(yearSpan(csv.yearsOf(seriesOf("supply", "amount"))));
  await expect(page.getByTestId("source-label")).toContainText("საქართველოს ეროვნული ბანკი");
});

test("the % of GDP icon shows all four aggregates against Fiscal.ge's GDP and keeps M1 selected", async ({ page }) => {
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
  const years = csv.gdpYearsOf(seriesOf("supply", "gdp")), latest = years.at(-1)!;
  await expect(page.getByTestId("money-latest")).toHaveText(`Broad money (M3), % of GDP · ${latest}: ${csv.shareOfGdp("money.m3", latest).toFixed(1)}%`);
  // The same four series, with the selection kept.
  await expect(page.getByTestId("series-status")).toContainText("3 / 4");
  for (const id of ["money.m3", "money.m2", "money.m1"]) await expect(page.locator(pressed(id))).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(pressed("money.m0"))).toHaveAttribute("aria-pressed", "false");
  await expect(page).toHaveURL(/tab=gdp/);
  await expect(page).toHaveURL(/sel=money\.m3(%2C|,)money\.m2(%2C|,)money\.m1(&|$)/);
  await expect(page.getByTestId("year-range-strip")).toContainText(yearSpan(years));
  const preliminary = years.filter(year => csv.isPreliminaryGdp(year));
  await expect(page.getByTestId("source-label")).toContainText(`GDP: Geostat, at current prices.${preliminary.length ? ` GDP for ${preliminary.join(", ")} is preliminary.` : ""}`);
  await page.getByTestId("chart-mode-table").click();
  await expect(await cell(page, "Narrow money (M1)", latest)).toHaveText(`${csv.shareOfGdp("money.m1", latest).toFixed(1)}%`);
  // Excel holds the calculated shares and cites Geostat's GDP beside the NBG file.
  const promise = page.waitForEvent("download"); await page.getByTestId("money-excel-download").click();
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await (await promise).path())!);
  const texts = (sheet: ExcelJS.Worksheet) => { const values: string[] = []; sheet.eachRow(row => row.eachCell(entry => { values.push(String(entry.value)); })); return values.join("\n"); };
  expect(texts(workbook.worksheets[2])).toMatch(/Geostat|National Statistics Office/);
  await page.getByTestId("chart-mode-line").click();
  await page.getByTestId("money-measure-amount").click();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "gel");
  await expect(page.getByTestId("money-unit-label")).toHaveText("bn GEL");
  const amountYear = csv.latestYear("money.m3");
  await expect(page.getByTestId("money-latest")).toContainText(`Broad money (M3) · ${amountYear}: ${csv.billions("money.m3", amountYear)}`);
  for (const id of ["money.m3", "money.m2", "money.m1"]) await expect(page.locator(pressed(id))).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(`[data-testid="series-row-toggle"][aria-pressed="true"]`)).toHaveCount(3);
  await expect(page.getByTestId("source-label")).not.toContainText("GDP");
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

test("the foreign-currency icon carries a deposits selection to its share and names the Excel file", async ({ page }) => {
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
  await expect(page.locator(pressed("deposits.fx_share"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(`[data-testid="series-row-toggle"][aria-pressed="true"]`)).toHaveCount(1);
  // The hash key and the Excel filename keep the view's id.
  const promise = page.waitForEvent("download"); await page.getByTestId("money-excel-download").click();
  expect((await promise).suggestedFilename()).toContain("money-loans-deposits-fx_share-");
});

test("the National Bank rate has no tabs, two decimals and a gap before 2008", async ({ page }) => {
  await page.goto("/en/explorer/money/interest-rates#view=table");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page.getByTestId("money-tabs")).toHaveCount(0);
  const latest = csv.latestYear("rates.policy");
  await expect(page.getByTestId("money-latest")).toContainText(`${latest}: ${csv.percent("rates.policy", latest)}%`);
  await expect(page.getByTestId("year-range-strip")).toContainText(yearSpan(csv.yearsOf(seriesOf("interest-rates", "main"))));
  await expect(await cell(page, "National Bank rate", latest)).toHaveText(`${csv.percent("rates.policy", latest)}%`);
  await expect(await cell(page, "National Bank rate", 2007)).toHaveText("—");
});

test("bank health has one list, a dash for capital before 2014 and the 2008 losses below zero", async ({ page }) => {
  await page.goto("/en/explorer/money/bank-health");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  const latest = csv.latestYear("banks.npl_ratio");
  await expect(page.getByTestId("money-latest")).toContainText(`${latest}: ${csv.percent("banks.npl_ratio", latest)}%`);
  await expect(page.getByTestId("money-tabs")).toHaveCount(0);
  await expect(page.getByTestId("year-range-strip")).toContainText(yearSpan(csv.yearsOf(seriesOf("bank-health", "main"))));
  await expect(page.getByTestId("series-status")).toContainText("1 / 5");
  await page.locator(pressed("banks.roa")).click();
  await page.locator(pressed("banks.roe")).click();
  // The axis runs below zero for the 2008 losses.
  await expect(page.getByTestId("chart-panel").locator("svg text", { hasText: /^−/ }).first()).toBeAttached();
  await page.locator(pressed("banks.capital_ratio")).click();
  await page.getByTestId("chart-mode-table").click();
  await expect(await cell(page, "Capital to risk-weighted assets", 2013)).toHaveText("—");
  await expect(await cell(page, "Capital to risk-weighted assets", 2014)).not.toHaveText("—");
  await expect(await cell(page, "Return on assets", 2008)).toHaveText(`${csv.percent("banks.roa", 2008)}%`);
  await expect(await cell(page, "Return on equity", 2008)).toHaveText(`${csv.percent("banks.roe", 2008)}%`);
});

test("clearing the selection shows the empty callout and disables Excel", async ({ page }) => {
  await page.goto("/explorer/money/supply");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page.getByTestId("no-selection-callout")).toHaveCount(0);
  await expect(page.getByTestId("money-excel-download")).toBeEnabled();
  await page.getByTestId("series-toggle-all").click();
  await expect(page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(0);
  await expect(page.getByTestId("no-selection-callout")).toBeVisible();
  await expect(page.getByTestId("money-excel-download")).toBeDisabled();
  await expect(page).toHaveURL(/sel=(&|$)/);
});

// One section with a measure key and one without; the others share the same state code.
const SAVED: Record<string, { hash: string; measure?: string; selected: string[]; range: string }> = {
  "loans-deposits": { hash: "tab=fx_share&view=table&sel=deposits.fx_share&start=2005&end=2015", measure: "fx_share", selected: ["deposits.fx_share"], range: "2005–2015" },
  "bank-health": { hash: "view=table&sel=banks.tier1_ratio&start=2016&end=2024", selected: ["banks.tier1_ratio"], range: "2016–2024" },
};

for (const section of Object.keys(SAVED)) {
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
