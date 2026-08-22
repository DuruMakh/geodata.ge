import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";
const SOURCE_ORIGIN = "http://localhost:3000";

async function downloadWorkbook(page: Page) {
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("series-excel").click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("Expected a local XLSX download path");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Uint8Array.from(await readFile(path)).buffer);
  return workbook;
}

async function ready(page: Page) {
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
}

function sourceLinks(workbook: ExcelJS.Workbook): string[] {
  const readable = workbook.getWorksheet("მარტივი ცხრილი")!;
  return readable.getSheetValues().flatMap((row) =>
    Array.isArray(row)
      ? row.flatMap((cell) => typeof cell === "object" && cell && "hyperlink" in cell ? [String(cell.hyperlink)] : [])
      : [],
  );
}

test("historical ministries 2005 cites the workbook and both reviewed split references", async ({ page }) => {
  await page.goto(`${BASE_URL}/explorer/expenditure#r=2005-2005`);
  await ready(page);
  await page.getByTestId("grouping-ministries").click();
  const workbook = await downloadWorkbook(page);
  const links = sourceLinks(workbook);
  expect(links).toContain(`${SOURCE_ORIGIN}/downloads/methodology/expenditure/files/2005/mof-excel-fact.xlsx`);
  expect(links).toContain(`${SOURCE_ORIGIN}/downloads/methodology/expenditure/files/2005/treasury-e11.pdf`);
  expect(links).toContain(`${SOURCE_ORIGIN}/downloads/methodology/expenditure/files/2005/mof-annual-execution.pdf`);
});

test("2013 fields cite the Chapter VI supplement while ministries cite the fact workbook", async ({ page }) => {
  await page.goto(`${BASE_URL}/explorer/expenditure#r=2013-2013`);
  await ready(page);
  const fields = await downloadWorkbook(page);
  const fieldLinks = sourceLinks(fields);
  expect(fieldLinks).toContain(`${SOURCE_ORIGIN}/downloads/methodology/expenditure/files/2013/treasury-e11.pdf`);
  expect(fieldLinks).toContain(`${SOURCE_ORIGIN}/downloads/methodology/expenditure/files/2013/mof-final-fact.pdf`);

  await page.getByTestId("grouping-ministries").click();
  const ministries = await downloadWorkbook(page);
  const ministryLinks = sourceLinks(ministries);
  expect(ministryLinks).toContain(`${SOURCE_ORIGIN}/downloads/methodology/expenditure/files/2013/mof-excel-fact.xlsx`);
  expect(ministryLinks).not.toContain(`${SOURCE_ORIGIN}/downloads/methodology/expenditure/files/2013/mof-final-fact.pdf`);
});

test("2014 ministries cite 2015-fact.xlsx with applicability year 2014", async ({ page }) => {
  await page.goto(`${BASE_URL}/explorer/expenditure#r=2014-2014`);
  await ready(page);
  await page.getByTestId("grouping-ministries").click();
  const workbook = await downloadWorkbook(page);
  const readable = workbook.getWorksheet("მარტივი ცხრილი")!;
  const links = sourceLinks(workbook);
  const applicabilityRow = readable.getSheetValues().find((row) => row && JSON.stringify(row).includes("/2015/mof-excel-fact.xlsx"));
  expect(Array.isArray(applicabilityRow)).toBe(true);
  if (!Array.isArray(applicabilityRow)) throw new Error("Expected the 2014 source row");
  expect(applicabilityRow[1]).toBe("2014");
  expect(links).toContain(`${SOURCE_ORIGIN}/downloads/methodology/expenditure/files/2015/mof-excel-fact.xlsx`);
});
