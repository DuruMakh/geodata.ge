import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";

const pressed = (id: string) => `[data-series-id="${id}"] [data-testid="series-row-toggle"]`;
const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");


const row = (page: Page, id: string) => page.locator(`[data-testid="regional-list-row"][data-region-id="${id}"]`);

test("income is the index: the map and list of regions with Georgia first, the measure switch and one source line, and no chart", async ({ page }) => {
  await page.goto("/explorer/living-standards/income");
  await ready(page);
  await expect(page.getByTestId("household-latest")).toContainText("2,025.8");
  await expect(page.getByTestId("household-region-map").getByTestId("regional-map-path")).toHaveCount(11);
  const rows = page.getByTestId("regional-list-row");
  await expect(rows).toHaveCount(12);
  await expect(rows.first()).toHaveAttribute("data-region-id", "georgia");
  await expect(rows.first()).toContainText("საქართველო");
  await expect(rows.first()).toContainText("2,025.8");
  await expect(rows.first()).not.toHaveAttribute("aria-current", /.*/);
  await expect(rows.nth(1)).toHaveAttribute("data-region-id", "region.tbilisi");
  // Georgia and each region are plain links to their own pages.
  await expect(rows.first()).toHaveAttribute("href", "/explorer/living-standards/income/regions/georgia");
  await expect(row(page, "region.guria")).toHaveAttribute("href", "/explorer/living-standards/income/regions/guria");
  await expect(page.getByTestId("household-region-map").locator('a[data-region-id="region.guria"]')).toHaveAttribute("href", "/explorer/living-standards/income/regions/guria");
  // No chart workspace, and the one source line is the map's own footer with the boundaries credit.
  for (const id of ["chart-panel", "chart-mode-line", "series-status", "household-excel-download", "household-chosen-area", "source-label"]) await expect(page.getByTestId(id)).toHaveCount(0);
  await expect(page.getByTestId("regional-source-note")).toHaveCount(1);
  await expect(page.getByTestId("regional-source-note")).toContainText("საქსტატი");
  await expect(page.getByTestId("regional-source-note")).toContainText("2025");
  await expect(page.getByTestId("regional-source-note")).toContainText("geoBoundaries");
  // The measure switch recolours the map and list, keeps per in the URL, and every link carries it.
  await page.getByTestId("household-measure-per_capita").click();
  await expect(page.getByTestId("household-regions")).toHaveAttribute("data-measure", "per_capita");
  await expect(page).toHaveURL(/\/explorer\/living-standards\/income#per=person$/);
  await expect(row(page, "region.tbilisi")).toContainText("745.4");
  await expect(rows.first()).toContainText("630.7");
  await expect(page.getByTestId("regional-map-legend")).toContainText("ერთ სულზე");
  await expect(rows.first()).toHaveAttribute("href", "/explorer/living-standards/income/regions/georgia#per=person");
  await expect(row(page, "region.guria")).toHaveAttribute("href", "/explorer/living-standards/income/regions/guria#per=person");
  // The household latest line stays Georgia per household.
  await expect(page.getByTestId("household-latest")).toContainText("2,025.8");
});

test("Georgia opens its own page: heading, 2002–2025, towns and villages as tickable lines, and per person carried over", async ({ page }) => {
  await page.goto("/explorer/living-standards/income#per=person");
  await ready(page);
  await page.getByTestId("regional-list-row").first().click();
  await expect(page).toHaveURL(/\/explorer\/living-standards\/income\/regions\/georgia#per=person$/);
  await ready(page);
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toContainText("შემოსავლები —");
  await expect(heading.getByTestId("region-picker-trigger")).toHaveText("საქართველო");
  await expect(page.getByTestId("household-latest")).toContainText("· საქართველო");
  await expect(page.getByTestId("household-latest")).toContainText("2,025.8");
  await expect(page.getByTestId("household-measure-per_capita")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("household-region-map")).toHaveCount(0);
  await expect(page.getByTestId("household-chosen-area")).toHaveCount(0);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-area", "georgia");
  await expect(page.getByTestId("year-range-strip")).toContainText("2002–2025");
  await expect(page.getByTestId("source-label")).not.toContainText("geoBoundaries");
  // Towns and villages follow the parts, unticked; only the total is selected.
  await expect(page.getByTestId("series-status")).toContainText("1 / 4");
  await expect(page.locator(pressed("income.total"))).toHaveAttribute("aria-pressed", "true");
  for (const id of ["settlement.urban", "settlement.rural"]) await expect(page.locator(pressed(id))).toHaveAttribute("aria-pressed", "false");
  const lines = page.getByTestId("chart-frame").locator("svg path[stroke-linejoin='round']");
  await expect(lines).toHaveCount(1);
  await page.locator(pressed("settlement.urban")).click();
  await expect(page.locator(pressed("settlement.urban"))).toHaveAttribute("aria-pressed", "true");
  await expect(lines).toHaveCount(2);
  await expect(page).toHaveURL(/sel=income\.total(,|%2C)settlement\.urban/);
  await page.getByTestId("chart-mode-table").click();
  await expect(page.getByTestId("chart-panel").getByRole("row").filter({ hasText: "ქალაქი" })).toHaveCount(1);
  // Breadcrumb: Living standards / Income / Georgia; the sidebar keeps Income active.
  const crumbs = page.getByTestId("explorer-header").getByRole("navigation", { name: "ნავიგაციის ბილიკი" }).first();
  await expect(crumbs.getByRole("link", { name: "შემოსავლები" })).toHaveAttribute("href", "/explorer/living-standards/income");
  await expect(crumbs.locator("[aria-current=page]")).toHaveText("საქართველო");
  await expect(page.getByTestId("living-standards-income-link")).toHaveAttribute("aria-current", "page");
  // Georgia comes first: previous wraps to the last region, next is the first.
  const navigation = page.getByTestId("household-region-navigation");
  await expect(navigation.getByRole("link")).toHaveText(["← შიდა ქართლი", "თბილისი →"]);
  await navigation.getByRole("link", { name: "← შიდა ქართლი" }).click();
  await expect(page).toHaveURL(/\/explorer\/living-standards\/income\/regions\/shida_kartli#per=person$/);
  await expect(page.getByTestId("region-picker-trigger")).toHaveText("შიდა ქართლი");
  await expect(page.getByTestId("household-region-navigation").getByRole("link").last()).toHaveText("საქართველო →");
  await page.goto("/explorer/living-standards/income/regions/georgia");
  await ready(page);
  await page.getByTestId("household-region-navigation").getByRole("link", { name: "თბილისი →" }).click();
  await expect(page).toHaveURL(/\/explorer\/living-standards\/income\/regions\/tbilisi$/);
  await expect(page.getByTestId("region-picker-trigger")).toHaveText("თბილისი");
});

// Income and Spending share the index-to-region flow; Income also pins the region page's contents.
for (const [section, heading] of [["income", "შემოსავლები —"], ["spending", "ხარჯები —"]] as const) {
  test(`the ${section} list opens a region's own page: its heading, years and sidebar entry${section === "income" ? ", latest value and lines, with no map" : ""}`, async ({ page }) => {
    await page.goto(`/explorer/living-standards/${section}`);
    await ready(page);
    await expect(page.getByTestId("household-region-map").getByTestId("regional-map-path")).toHaveCount(11);
    await row(page, "region.guria").click();
    await expect(page).toHaveURL(new RegExp(`/explorer/living-standards/${section}/regions/guria$`));
    await ready(page);
    const heading1 = page.getByRole("heading", { level: 1 });
    await expect(heading1).toContainText(heading);
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-area", "region.guria");
    await expect(page.getByTestId("year-range-strip")).toContainText("2019–2025");
    await expect(page.getByTestId(`living-standards-${section}-link`)).toHaveAttribute("aria-current", "page");
    if (section !== "income") return;
    await expect(heading1.getByTestId("region-picker-trigger")).toHaveText("გურია");
    await expect(page.getByTestId("household-latest")).toContainText("· გურია");
    await expect(page.getByTestId("household-region-map")).toHaveCount(0);
    await expect(page.getByTestId("regional-list-row")).toHaveCount(0);
    await expect(page.getByTestId("household-chosen-area")).toHaveCount(0);
    await expect(page.locator(pressed("income.total"))).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(pressed("settlement.urban"))).toHaveCount(0);
    await expect(page.getByTestId("source-label")).toContainText("2019–2025");
    await expect(page.getByTestId("source-label")).not.toContainText("geoBoundaries");
    await expect(page.getByTestId("household-excel-download")).toBeEnabled();
    // Breadcrumb: Living standards / Income / Guria; the sidebar keeps Income active.
    const crumbs = page.getByTestId("explorer-header").getByRole("navigation", { name: "ნავიგაციის ბილიკი" }).first();
    await expect(crumbs.getByRole("link", { name: "შემოსავლები" })).toHaveAttribute("href", "/explorer/living-standards/income");
    await expect(crumbs.locator("[aria-current=page]")).toHaveText("გურია");
  });
}

test("a map region carries per person to its page, and the picker and previous/next links move between regions", async ({ page }) => {
  await page.goto("/en/explorer/living-standards/income");
  await ready(page);
  // The measure icons switch the map and list values, and the region links carry the choice.
  await expect(page.getByTestId("household-measure-per_household")).toHaveAccessibleName("Per household");
  await expect(page.getByTestId("household-measure-per_capita")).toHaveAccessibleName("Per person");
  await expect(page.getByTestId("household-measure-per_household").locator("svg")).toHaveAttribute("data-icon", "family-restroom");
  await page.getByTestId("household-measure-per_capita").click();
  await expect(row(page, "region.kakheti")).toHaveAttribute("href", "/en/explorer/living-standards/income/regions/kakheti#per=person");
  await page.getByTestId("household-region-map").locator('a[data-region-id="region.kakheti"]').click();
  await expect(page).toHaveURL(/\/en\/explorer\/living-standards\/income\/regions\/kakheti#per=person/);
  await ready(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Income —");
  await expect(page.getByTestId("region-picker-trigger")).toHaveText("Kakheti");
  await expect(page.getByTestId("household-measure-per_capita")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("year-range-strip")).toContainText("2011–2025");
  // The picker opens the list and goes to another region.
  await page.getByTestId("region-picker-trigger").click();
  // Georgia leads the picker, and its all-regions entry returns to the index.
  await expect(page.getByTestId("region-picker-option")).toHaveCount(12);
  await expect(page.getByTestId("region-picker-option").first()).toHaveText("Georgia");
  await expect(page.getByTestId("region-picker-all-option")).toHaveAttribute("href", "/en/explorer/living-standards/income#per=person");
  await page.getByTestId("region-picker-option").filter({ hasText: "Guria" }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/living-standards\/income\/regions\/guria#per=person/);
  await ready(page);
  await expect(page.getByTestId("region-picker-trigger")).toHaveText("Guria");
  await expect(page.getByTestId("household-latest")).toContainText("· Guria");
  await expect(page.getByTestId("year-range-strip")).toContainText("2019–2025");
  // Previous and next follow the regions' order.
  const navigation = page.getByTestId("household-region-navigation");
  await expect(navigation.getByRole("link")).toHaveText(["← Adjara", "Imereti →"]);
  await navigation.getByRole("link", { name: "Imereti →" }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/living-standards\/income\/regions\/imereti/);
  await expect(page.getByTestId("region-picker-trigger")).toHaveText("Imereti");
  await page.getByTestId("household-region-navigation").getByRole("link", { name: "← Guria" }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/living-standards\/income\/regions\/guria/);
  await expect(page.getByTestId("region-picker-trigger")).toHaveText("Guria");
});


test("Georgia's spending page reads consumption spending and exports Excel with the ticked towns line", async ({ page }) => {
  await page.goto("/en/explorer/living-standards/spending/regions/georgia#sel=spending.consumption,settlement.urban");
  await ready(page);
  await expect(page.getByTestId("household-latest")).toContainText("1,438.7");
  await expect(page.locator(pressed("settlement.urban"))).toHaveAttribute("aria-pressed", "true");
  const promise = page.waitForEvent("download"); await page.getByTestId("household-excel-download").click();
  const download = await promise;
  expect(download.suggestedFilename()).toBe("fiscal-household-spending-georgia-per-household-2002-2025-en.xlsx");
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await download.path())!);
  expect(workbook.worksheets).toHaveLength(3);
  const data = workbook.getWorksheet("Data")!;
  expect(data.rowCount).toBe(49);
  expect(data.getColumn(2).values).toContain("Towns");
});

test("the language switch keeps the region or Georgia page and its hash", async ({ page }) => {
  await page.goto("/explorer/living-standards/income/regions/adjara#per=person&view=table&sel=income.total,income.remittances");
  await ready(page);
  await page.getByTestId("language-switch").first().getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/living-standards\/income\/regions\/adjara#/);
  await ready(page);
  await expect(page.getByTestId("region-picker-trigger")).toHaveText("Adjara");
  await expect(page.getByTestId("household-measure-per_capita")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  await expect(page.locator(pressed("income.total"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(pressed("income.remittances"))).toHaveAttribute("aria-pressed", "true");
  // A second hop for Georgia's page with the villages line ticked.
  await page.goto("/explorer/living-standards/income/regions/georgia#per=person&sel=income.total,settlement.rural");
  await ready(page);
  await page.getByTestId("language-switch").first().getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/living-standards\/income\/regions\/georgia#/);
  await ready(page);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-area", "georgia");
  await expect(page.getByTestId("household-measure-per_capita")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(pressed("settlement.rural"))).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/sel=income\.total(,|%2C)settlement\.rural/);
});

test("the per household icon shows in both the plain and the pressed button", async ({ page }) => {
  await page.goto("/en/explorer/living-standards/income");
  await ready(page);
  const button = page.getByTestId("household-measure-per_household");
  const icon = button.locator("svg");
  const user = page.getByTestId("household-measure-per_capita").locator("svg");
  expect(await icon.boundingBox().then(box => [box!.width, box!.height])).toEqual(await user.boundingBox().then(box => [box!.width, box!.height]));
  const colours = () => button.evaluate(element => [getComputedStyle(element.querySelector("svg")!).fill, getComputedStyle(element).backgroundColor, getComputedStyle(element.closest("[role=group]")!.parentElement!).backgroundColor]);
  for (const state of ["pressed", "plain"]) {
    if (state === "plain") await page.getByTestId("household-measure-per_capita").click();
    await expect(button).toHaveAttribute("aria-pressed", state === "pressed" ? "true" : "false");
    const [fill, background] = await colours();
    expect(fill, state).toMatch(/^rgb/);
    expect(fill, state).not.toBe(background);
    expect(fill, state).not.toBe("rgba(0, 0, 0, 0)");
  }
});


// The hub, Income, Spending and Georgia's Income page at their defaults: the layout pass in mobile-fit-charts.spec.ts.
for (const prefix of ["", "/en"]) test(`household pages fit a 390px screen ${prefix || "ka"}`, async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 900 });
  for (const path of ["/explorer/living-standards/spending/regions/georgia#sel=spending.consumption,settlement.urban,settlement.rural", "/explorer/living-standards/income/regions/racha_lechkhumi_kvemo_svaneti", "/explorer/living-standards/spending/regions/samegrelo_zemo_svaneti#per=person"]) {
    await page.goto(`${prefix}${path}`);
    await ready(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
  }
  expect(errors).toEqual([]);
});
