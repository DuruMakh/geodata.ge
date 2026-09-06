import { expect, test, type Page, type TestInfo } from "@playwright/test";
import ExcelJS from "exceljs";

async function download(page: Page, path: string, testInfo: TestInfo, name: string) {
  await page.goto(path);
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  const pending = page.waitForEvent("download");
  await page.getByTestId("series-excel").click();
  const result = await pending;
  const output = testInfo.outputPath(`${name}.xlsx`);
  await result.saveAs(output);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(output);
  return { workbook, filename: result.suggestedFilename() };
}

function structureAndValues(workbook: ExcelJS.Workbook) {
  return workbook.worksheets.map(sheet => Array.from({ length: sheet.rowCount }, (_, row) =>
    Array.from({ length: sheet.columnCount }, (_, column) => {
      const cell = sheet.getCell(row + 1, column + 1);
      if (cell.type === ExcelJS.ValueType.Number || cell.type === ExcelJS.ValueType.Formula) return cell.value;
      return cell.value === null ? null : "text";
    }),
  ));
}

function sourceRecords(workbook: ExcelJS.Workbook) {
  const sheet = workbook.worksheets[2];
  return Array.from({ length: Math.max(0, sheet.rowCount - 3) }, (_, index) => ({
    period: sheet.getCell(index + 4, 1).value,
    url: (sheet.getCell(index + 4, 4).value as ExcelJS.CellHyperlinkValue).hyperlink,
    retrieved: sheet.getCell(index + 4, 5).value,
  }));
}

for (const [name, route] of [
  ["fields", "/explorer/expenditure#g=fields&m=table&r=2020-2025&sel=expenditure.total,spending.education"],
  ["gdp-share", "/explorer/expenditure#g=fields&m=table&sh=1&r=2020-2025&sel=expenditure.total,spending.education"],
  ["ministries", "/explorer/expenditure#g=ministries&m=table&r=2014-2025&sel=admin_spending.total,admin_spending.defence"],
  ["receipts", "/explorer/revenue#m=table&r=2004-2025&sel=revenue.total,revenue.vat"],
] as const) {
  test(`${name} downloads an English workbook with identical numbers and originals`, async ({ page, request }, testInfo) => {
    const ka = await download(page, route, testInfo, `${name}-ka`);
    const en = await download(page, `/en${route}`, testInfo, `${name}-en`);
    expect(en.filename).toBe(ka.filename.replace(/\.xlsx$/, "-en.xlsx"));
    expect(en.workbook.worksheets.map(sheet => sheet.name)).toEqual(["Summary", "Data", "Sources"]);
    expect(structureAndValues(en.workbook)).toEqual(structureAndValues(ka.workbook));
    const records = sourceRecords(en.workbook);
    expect(records).toEqual(sourceRecords(ka.workbook));
    expect(records.length).toBeGreaterThan(0);
    en.workbook.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => {
      expect(JSON.stringify(cell.value)).not.toMatch(/\p{Script=Georgian}/u);
      expect(cell.numFmt ?? "").not.toMatch(/\p{Script=Georgian}/u);
    })));
    const archive = records.find(record => new URL(record.url).pathname.startsWith("/downloads/methodology/"));
    expect(archive).toBeDefined();
    expect((await request.get(new URL(archive!.url).pathname)).status()).toBe(200);
  });
}
