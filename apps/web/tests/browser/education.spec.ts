import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";

const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
const toggle = (id: string) => `[data-series-id="${id}"] [data-testid="series-row-toggle"]`;
const pressedRows = (page: Page) => page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]');
const SECTIONS = ["schools", "kindergartens", "universities", "vocational"];
/** Every cell of a sheet as text. */
const sheetText = (sheet: ExcelJS.Worksheet) => {
  const values: string[] = [];
  sheet.eachRow(row => row.eachCell(cell => { values.push(String(cell.value)); }));
  return values;
};
/** The year labels under the drawn chart: four digits, or a school year such as 2025/26. */
const axisYears = async (page: Page) => (await page.getByTestId("chart-panel").locator('svg[role="img"]:visible text').allTextContents())
  .map(text => text.trim()).filter(text => /^\d{4}(\/\d{2})?$/.test(text));

/** The table cell of the series labelled `label` in the year `period`, in either layout: year columns, or (a narrow table of up to three series) year rows. */
async function cell(page: Page, label: string, period: string) {
  const table = page.getByTestId("explorer-table");
  const headers = (await table.locator("thead th").allInnerTexts()).map(text => text.trim());
  const yearRow = (await table.getAttribute("data-layout")) === "rows";
  const column = headers.findIndex(text => yearRow ? text.includes(label) : text.startsWith(period));
  expect(column, `${label} ${period}`).toBeGreaterThan(0);
  const heading = yearRow ? new RegExp(`^${period.replace("/", "\\/")}`) : label;
  // The row's label is its <th>, so value cells start one column earlier.
  return table.locator("tbody tr", { has: page.locator("th", { hasText: heading }) }).locator("td").nth(column - 1);
}

async function download(page: Page) {
  const promise = page.waitForEvent("download");
  await page.getByTestId("education-excel-download").click();
  const file = await promise;
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await file.path())!);
  return { name: file.suggestedFilename(), workbook };
}

test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 }); });

test("the hub shows four cards, Schools in school years, and the sidebar lists Education after Health", async ({ page }) => {
  for (const prefix of ["", "/en"]) {
    await page.goto(`${prefix}/explorer/education`);
    const cards = page.getByTestId("education-hub").getByTestId("hub-card");
    await expect(cards).toHaveCount(4);
    expect(await cards.evaluateAll(links => links.map(link => link.getAttribute("href")))).toEqual(SECTIONS.map(section => `${prefix}/explorer/education/${section}`));
    for (let index = 0; index < 4; index += 1) await expect(cards.nth(index).locator("svg")).toHaveCount(1);
    await expect(cards.first()).toContainText("2025/26 · 644.2");
    await expect(cards.first()).toContainText("2000/01–2025/26");
    await expect(cards.last()).toContainText("2025 · 19,690 · 2013–2025");
    const entry = page.getByTestId("education-link");
    await expect(entry).toHaveAttribute("aria-current", "page");
    expect(await page.getByTestId("health-link").evaluate((health, education) => Boolean(health.compareDocumentPosition(education!) & Node.DOCUMENT_POSITION_FOLLOWING), await entry.elementHandle())).toBe(true);
    for (const section of SECTIONS) await expect(page.getByTestId(`education-${section}-link`)).toBeVisible();
  }
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Education");
});

test("the Schools index draws the municipality map, lists Georgia first and opens Tbilisi's region page", async ({ page }) => {
  await page.goto("/explorer/education/schools");
  await ready(page);
  await expect(page.getByTestId("education-latest")).toHaveText("2025/26: 644.2 ათასი მოსწავლე 2,292 სკოლაში");
  await expect(page.getByTestId("municipality-map")).toBeVisible();
  await expect(page.getByTestId("index-kpi")).toHaveCount(0);
  await expect(page.getByTestId("explorer-dataset-json-ld")).toHaveCount(1);
  // Georgia is the regions list's first, unranked row, in thousands.
  await page.getByTestId("level-region").click();
  const rows = page.getByTestId("municipal-list-row");
  await expect(rows).toHaveCount(12);
  await expect(rows.first()).toContainText("საქართველო");
  await expect(rows.first()).toContainText("644.2");
  await expect(rows.first()).toHaveAttribute("href", "/explorer/education/schools/georgia");
  // Tbilisi is one place: its city dot opens the region page.
  await page.getByTestId("municipality-marker-04").click();
  await expect(page).toHaveURL(/\/explorer\/education\/schools\/region\/tbilisi$/);
  await ready(page);
  await expect(page.getByTestId("entity-picker-trigger")).toHaveText("თბილისი");
  await expect(page.getByTestId("region-member-row")).toHaveCount(0);
});

test("Guria's Schools page: latest line, three headings, one heading at a time, its municipalities and the next region", async ({ page }) => {
  await page.goto("/explorer/education/schools/region/guria");
  await ready(page);
  await expect(page.getByTestId("education-latest")).toHaveText("2025/26: 13,743 მოსწავლე · გურია");
  await expect(page.getByTestId("series-heading")).toHaveText(["მოსწავლეები", "მასწავლებლები", "სკოლები"]);
  await expect(page.getByTestId("series-row")).toHaveCount(5);
  await expect(pressedRows(page)).toHaveCount(1);
  await expect(page.locator(toggle("education.pupils.total"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("year-range-strip")).toContainText("2005/06");
  await expect(page.getByTestId("source-label")).toContainText("საქსტატი");
  // The region lists its three municipalities, ranked by pupils.
  await expect(page.getByTestId("region-member-row")).toHaveCount(3);
  await expect(page.getByTestId("region-member-row").first()).toContainText("ოზურგეთი");
  // Ticking Teachers → Women replaces Pupils, and the years refit to teachers' 2016/17 start.
  await page.locator(toggle("education.teachers.women")).click();
  await expect(pressedRows(page)).toHaveCount(1);
  await expect(page.locator(toggle("education.pupils.total"))).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-heading", "teachers");
  await expect(page.getByTestId("year-range-strip")).toContainText("2016/17");
  await expect(page.getByTestId("year-range-strip")).not.toContainText("2005/06");
  await expect(page).toHaveURL(/#view=line&sel=education\.teachers\.women&range=all$/);
  // The next link opens the next region with the selection.
  const navigation = page.getByTestId("municipal-entity-navigation");
  await expect(navigation.getByRole("link")).toHaveText(["← აჭარა", "იმერეთი →"]);
  await navigation.getByRole("link").last().click();
  await expect(page).toHaveURL(/\/explorer\/education\/schools\/region\/imereti#view=line&sel=education\.teachers\.women&range=all$/);
  await ready(page);
  await expect(page.locator(toggle("education.teachers.women"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("region-member-row")).toHaveCount(12);
});

test("the picker, previous/next and the language switch keep the mode, years and selection on a place page", async ({ page }) => {
  const hash = "#view=table&sel=education.teachers.women&start=2018&end=2022";
  await page.goto(`/explorer/education/schools/region/guria${hash}`);
  await ready(page);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  await expect(page.getByTestId("year-range-strip")).toContainText("2018/19");
  const carried = /#view=table&sel=education\.teachers\.women&start=2018&end=2022$/;
  await expect(page.getByTestId("municipal-entity-navigation").getByRole("link").first()).toHaveAttribute("href", carried);
  await page.getByTestId("entity-picker-trigger").click();
  await expect(page.getByTestId("picker-region").filter({ hasText: "აჭარა" })).toHaveAttribute("href", /\/explorer\/education\/schools\/region\/adjara#view=table&sel=education\.teachers\.women&start=2018&end=2022$/);
  await expect(page.getByTestId("picker-municipality").filter({ hasText: "ბათუმი" })).toHaveAttribute("href", /\/explorer\/education\/schools\/batumi#view=table&sel=education\.teachers\.women&start=2018&end=2022$/);
  // Georgia's page lists the same row, so the selection moves there unchanged.
  await expect(page.getByTestId("picker-country")).toHaveAttribute("href", /\/explorer\/education\/schools\/georgia#view=table&sel=education\.teachers\.women&start=2018&end=2022$/);
  await page.keyboard.press("Escape");
  // The language switch keeps the whole hash.
  await page.getByTestId("language-switch").first().getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/education\/schools\/region\/guria#view=table&sel=education\.teachers\.women&start=2018&end=2022$/);
  await ready(page);
  await expect(page.getByTestId("entity-picker-trigger")).toHaveText("Guria");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  await expect(page.locator(toggle("education.teachers.women"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("explorer-table")).toContainText("Teachers — Women");
  await expect(page.getByTestId("year-range-strip")).toContainText("2018/19");
  // Previous follows to Adjara with the same state.
  await page.getByTestId("municipal-entity-navigation").getByRole("link", { name: "← Adjara" }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/education\/schools\/region\/adjara#view=table&sel=education\.teachers\.women&start=2018&end=2022$/);
  await ready(page);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  await expect(page.locator(toggle("education.teachers.women"))).toHaveAttribute("aria-pressed", "true");
});

test("Georgia's Schools page: the table from 2000/01 with private pupils, in thousands", async ({ page }) => {
  await page.goto("/explorer/education/schools/georgia");
  await ready(page);
  await expect(page.getByTestId("education-latest")).toHaveText("2025/26: 644.2 ათასი მოსწავლე · საქართველო");
  await expect(page.getByTestId("municipal-entity-navigation")).toHaveCount(0);
  await expect(page.getByTestId("series-row")).toHaveCount(11);
  await page.locator(toggle("education.pupils_national.private")).click();
  await expect(pressedRows(page)).toHaveCount(2);
  await page.getByTestId("chart-mode-table").click();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  const table = page.getByTestId("explorer-table");
  await expect(table).toContainText("2000/01");
  await expect(await cell(page, "მოსწავლეები — კერძო სკოლები", "2000/01")).toHaveText("12.1");
  await expect(await cell(page, "მოსწავლეები — კერძო სკოლები", "2025/26")).toHaveText("72.0");
});

test("2009 reads 2009/10 on the range strip, the chart, its tooltip, the table and in Excel", async ({ page }) => {
  await page.goto("/explorer/education/schools/georgia#view=line&sel=education.pupils_national.total&start=2009&end=2012");
  await ready(page);
  await expect(page.getByTestId("year-range-strip")).toContainText("2009/10");
  await expect(page.getByTestId("year-range-strip")).not.toContainText(/2009(?!\/10)/);
  const chart = page.getByTestId("chart-panel").locator('svg[role="img"]:visible');
  await expect(chart).toHaveAttribute("aria-label", /2009\/10–2012\/13$/);
  expect(await axisYears(page)).toContain("2009/10");
  expect((await axisYears(page)).every(label => label.includes("/"))).toBe(true);
  await chart.focus();
  await page.keyboard.press("Home");
  await expect(page.getByTestId("chart-tooltip")).toContainText("2009/10");
  const { workbook } = await download(page);
  expect(sheetText(workbook.worksheets[0])).toContain("2009/10");
  expect(sheetText(workbook.worksheets[1])).toContain("2009/10");
  expect([...sheetText(workbook.worksheets[0]), ...sheetText(workbook.worksheets[1])]).not.toContain("2009");
  await page.getByTestId("chart-mode-table").click();
  await expect(await cell(page, "მოსწავლეები", "2009/10")).toHaveText(/^\d+\.\d$/);
  await expect(page.getByTestId("explorer-table")).not.toContainText(/2009(?!\/10)/);
});

test("Kindergartens in Tbilisi start at 2017/18", async ({ page }) => {
  await page.goto("/explorer/education/kindergartens/region/tbilisi");
  await ready(page);
  await expect(page.getByTestId("education-latest")).toContainText("2025/26");
  await expect(page.getByTestId("series-heading")).toHaveText(["ბავშვები", "პერსონალი", "ბაღები"]);
  await expect(page.locator(toggle("education.kg_children.total"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("year-range-strip")).toContainText("2017/18");
  await expect(page.getByTestId("year-range-strip")).not.toContainText("2016/17");
});

test("Universities: one row selected, search keeps the count, and graduates' missing year is a dash", async ({ page }) => {
  await page.goto("/explorer/education/universities");
  await ready(page);
  await expect(page.getByTestId("education-latest")).toHaveText("2025/26: 195,426 სტუდენტი უნივერსიტეტებში");
  // Graduates end a school year before students: their heading names 2024/25 and their rows show it, never a dash.
  await expect(page.getByTestId("series-heading")).toHaveText(["სტუდენტები", "მიღებული სტუდენტები", "კურსდამთავრებულები · 2024/25"]);
  await expect(page.locator('[data-series-id="education.he_graduates.total"]').first()).toContainText("32,494");
  await expect(page.getByTestId("series-row")).toHaveCount(48);
  await expect(pressedRows(page)).toHaveCount(1);
  await expect(page.locator(toggle("education.he_students.total"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("series-status")).toContainText("1 / 48");
  await expect(page.getByTestId("year-range-strip")).toContainText("2011/12");
  // No tab row and no measure switch.
  await expect(page.locator('[role="tablist"]')).toHaveCount(0);
  // Search shows the three Women rows (and keeps the pinned total); it never changes the count.
  await page.getByTestId("series-search").fill("ქალ");
  await expect(page.locator('[data-series-id$=".women"]:visible')).toHaveCount(3);
  await expect(page.locator('[data-series-id$=".men"]:visible')).toHaveCount(0);
  await expect(page.getByTestId("series-status")).toContainText("1 / 48");
  await page.getByTestId("series-search").fill("");
  // Graduates of calendar 2025 sit under 2024/25: the students-and-graduates mix spans 2010/11–2025/26 with gaps, not zeros.
  await page.locator(toggle("education.he_graduates.total")).click();
  await expect(pressedRows(page)).toHaveCount(2);
  await expect(page.getByTestId("year-range-strip")).toContainText("2010/11");
  await page.getByTestId("chart-mode-table").click();
  await expect(await cell(page, "კურსდამთავრებულები — ყველა", "2025/26")).toHaveText("—");
  await expect(await cell(page, "კურსდამთავრებულები — ყველა", "2024/25")).toHaveText("32,494");
  await expect(await cell(page, "სტუდენტები — ყველა", "2010/11")).toHaveText("—");
  await expect(page).toHaveURL(/#view=table&sel=education\.he_students\.total%2Ceducation\.he_graduates\.total&range=all$/);
  // The language switch keeps the hash.
  await page.getByTestId("language-switch").first().getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/education\/universities#view=table&sel=education\.he_students\.total%2Ceducation\.he_graduates\.total&range=all$/);
  await ready(page);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  await expect(pressedRows(page)).toHaveCount(2);
  await expect(await cell(page, "Graduates — All", "2025/26")).toHaveText("—");
  await expect(page.getByTestId("series-heading").last()).toHaveText("Graduates · 2024/25");
  await expect(page.locator('[data-series-id="education.he_graduates.total"]').first()).toContainText("32,494");
  // Excel: the selection, in school years.
  const { name, workbook } = await download(page);
  expect(name).toBe("fiscal-education-universities-2010-11-2025-26-en.xlsx");
  expect(workbook.worksheets).toHaveLength(3);
  expect(sheetText(workbook.worksheets[0])).toContain("2024/25");
  // The Sources sheet links to the fiscal.ge archive copies of the Geostat workbooks.
  const links: string[] = [];
  workbook.worksheets[2].eachRow(row => row.eachCell(cell => { const value = cell.value as { hyperlink?: string } | null; if (value && typeof value === "object" && value.hyperlink) links.push(value.hyperlink); }));
  expect(links.length).toBeGreaterThan(0);
  for (const link of links) expect(link).toContain("/downloads/methodology/education/files/");
});

test("Vocational colleges: 24 rows, no old field, calendar years", async ({ page }) => {
  await page.goto("/en/explorer/education/vocational");
  await ready(page);
  await expect(page.getByTestId("education-latest")).toHaveText("2025: 19,690 admitted to vocational colleges");
  await expect(page.getByTestId("series-heading")).toHaveText(["Admitted", "Graduates"]);
  await expect(page.getByTestId("series-row")).toHaveCount(24);
  await expect(page.locator('[data-series-id*=".old_"]')).toHaveCount(0);
  await expect(page.getByTestId("series-label").filter({ hasText: /^Law$/ })).toHaveCount(0);
  await expect(page.locator(toggle("education.vet_admitted.total"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("year-range-strip")).toContainText("2013");
  await expect(page.getByTestId("year-range-strip")).not.toContainText("/");
  const years = await axisYears(page);
  expect(years).toContain("2013");
  expect(years.every(label => /^\d{4}$/.test(label))).toBe(true);
});

test("a place page's Excel download is a workbook in school years", async ({ page }) => {
  await page.goto("/explorer/education/schools/region/guria");
  await ready(page);
  const { name, workbook } = await download(page);
  expect(name).toBe("fiscal-education-schools-guria-2005-06-2025-26.xlsx");
  expect(workbook.worksheets).toHaveLength(3);
  expect(sheetText(workbook.worksheets[0])).toContain("2025/26");
  // The Sources sheet links to the fiscal.ge archive copies of the Geostat workbooks.
  const links: string[] = [];
  workbook.worksheets[2].eachRow(row => row.eachCell(cell => { const value = cell.value as { hyperlink?: string } | null; if (value && typeof value === "object" && value.hyperlink) links.push(value.hyperlink); }));
  expect(links.length).toBeGreaterThan(0);
  for (const link of links) expect(link).toContain("/downloads/methodology/education/files/");
});

for (const prefix of ["", "/en"]) test(`the methodology link opens the education methodology with its original files ${prefix || "ka"}`, async ({ page }) => {
  await page.goto(`${prefix}/explorer/education/universities`);
  await ready(page);
  await page.getByTestId("source-label").getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`${prefix}/methodology/education$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(prefix ? "Education" : "განათლება");
  const archived = page.locator('a[href^="/downloads/methodology/education/files/"]');
  expect(await archived.count()).toBeGreaterThan(0);
  const response = await page.request.get(await archived.first().getAttribute("href") as string);
  expect(response.status()).toBe(200);
});

for (const prefix of ["", "/en"]) test(`education pages fit a 390px screen ${prefix || "ka"}`, async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 900 });
  for (const path of ["", "/schools", "/kindergartens", "/schools/region/guria", "/universities", "/vocational"].map(path => `/explorer/education${path}`)) {
    await page.goto(`${prefix}${path}`);
    if (path !== "/explorer/education") await ready(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
  }
  expect(errors).toEqual([]);
});
