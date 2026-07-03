import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { EXPENDITURE_DETAILED_YEARS } from "../lib/data/coverage";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { generateCandidateMappings } from "../lib/data/realExpenditure/candidateMapping";
import { parseAdminWorkbookRows } from "../lib/data/adminSpending/extractWorkbooks";
import type { MatrixCell } from "../lib/data/realExpenditure/parseTavi6Rows";
import {
  composeFinalExpenditureFacts,
  extractFinancialAssetAndLiabilitySupplements,
  final2025ExpenditureFactsToCsv,
  final2025SupplementsToCsv,
  finalExpenditureOutputFiles,
  type SupplementMapping,
  type WorkbookStagingRow,
} from "../lib/data/realExpenditurePdf/final2025Data";
import {
  generateCompactPdfSpendingMappings,
  validateCompactPdfSpendingMappings,
} from "../lib/data/realExpenditurePdf/publicMapping";
import { parseExpenditurePdfText, readPdfTextPages, sha256File } from "../lib/data/realExpenditurePdf/phase1Pilot";

const sourcesByYear = {
  2004: {
    year: 2004,
    sourceId: "source.mof_2004_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2004-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "33EE4A12881FB6AA6B3D7221ABBF8FEB61F1764B448B6F8A76155CC24AF67A97",
    formId: "E11",
    tableTitle: "2004 state budget expenditure execution by functional classification",
    actualAmountIndex: 1,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2004-fact.xlsx",
    workbookSourceId: "source.mof_2004_programmatic_fact_actual",
    finalSourceId: "source.mof_2004_expenditure_functional_plus_programmatic_supplement_actual",
  },  2005: {
    year: 2005,
    sourceId: "source.mof_2005_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2005-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "BFC38ACBD91515A224AC9148635537C163662D4BB36E2AD28C963D33FA4F9622",
    formId: "E11",
    tableTitle: "2005 state budget expenditure execution by functional classification",
    actualAmountIndex: 1,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2005-fact.xlsx",
    workbookSourceId: "source.mof_2005_programmatic_fact_actual",
    finalSourceId: "source.mof_2005_expenditure_functional_plus_programmatic_supplement_actual",
  },  2006: {
    year: 2006,
    sourceId: "source.mof_2006_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2006-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "5088EDA02D6C4DA13B3D2C70E7C6C8781C41207DAEB3538E033B34F5EADF6EF2",
    formId: "E11",
    tableTitle: "2006 state budget expenditure execution by functional classification",
    actualAmountIndex: 1,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2006-fact.xlsx",
    workbookSourceId: "source.mof_2006_programmatic_fact_actual",
    finalSourceId: "source.mof_2006_expenditure_functional_plus_programmatic_supplement_actual",
  },  2007: {
    year: 2007,
    sourceId: "source.mof_2007_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2007-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "F3CC7E9C14F332EEB6379C1643E2D4B2B0598F9452B2C26CF4F3C6B0498279EB",
    formId: "E11",
    tableTitle: "2007 state budget expenditure execution by functional classification",
    actualAmountIndex: 1,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2007-fact.xlsx",
    workbookSourceId: "source.mof_2007_programmatic_fact_actual",
    finalSourceId: "source.mof_2007_expenditure_functional_plus_programmatic_supplement_actual",
  },  2008: {
    year: 2008,
    sourceId: "source.mof_2008_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2008-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "268178E50F8697B584C87B1E18C0DF766167FEF822B157FF3BB3EEF08FF2C744",
    formId: "E11",
    tableTitle: "2008 state budget expenditure execution by functional classification",
    actualAmountIndex: 1,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2008-fact.xlsx",
    workbookSourceId: "source.mof_2008_programmatic_fact_actual",
    finalSourceId: "source.mof_2008_expenditure_functional_plus_programmatic_supplement_actual",
  },  2009: {
    year: 2009,
    sourceId: "source.mof_2009_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2009-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "C3558042D58E1E9D2CE3E1C8169DB4276B96294931D356107D01D8ADD24E8C63",
    formId: "E11",
    tableTitle: "2009 state budget expenditure execution by functional classification",
    actualAmountIndex: 1,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2009-fact.xlsx",
    workbookSourceId: "source.mof_2009_programmatic_fact_actual",
    finalSourceId: "source.mof_2009_expenditure_functional_plus_programmatic_supplement_actual",
  },  2010: {
    year: 2010,
    sourceId: "source.mof_2010_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2010-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "F98A74D4869037398DD83C09DF1BBE3B90EFE97B90F8F5FBB567720CC0B934FF",
    formId: "E11",
    tableTitle: "2010 state budget expenditure execution by functional classification",
    actualAmountIndex: 1,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2010-fact.xlsx",
    workbookSourceId: "source.mof_2010_programmatic_fact_actual",
    finalSourceId: "source.mof_2010_expenditure_functional_plus_programmatic_supplement_actual",
  },  2011: {
    year: 2011,
    sourceId: "source.mof_2011_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2011-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "5D9726640265EA1882C9F08DD3F234BBE31F9B7DF928A3BB80C6B9F4DD27480D",
    formId: "E11",
    tableTitle: "2011 state budget expenditure execution by functional classification",
    actualAmountIndex: 1,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2011-fact.xlsx",
    workbookSourceId: "source.mof_2011_programmatic_fact_actual",
    finalSourceId: "source.mof_2011_expenditure_functional_plus_programmatic_supplement_actual",
  },  2012: {
    year: 2012,
    sourceId: "source.mof_2012_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2012-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "8509167D1D564218B9B8BAEC3455437F4D82E417D45176B8608D3CCA623DDD4F",
    formId: "E11",
    tableTitle: "2012 state budget expenditure execution by functional classification",
    actualAmountIndex: 1,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2012-fact.xlsx",
    workbookSourceId: "source.mof_2012_programmatic_fact_actual",
    finalSourceId: "source.mof_2012_expenditure_functional_plus_programmatic_supplement_actual",
  },  2013: {
    year: 2013,
    sourceId: "source.mof_2013_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2013-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "84088FD0EA3E944E5E5CBD865191D3D02228307C13B5F0877423C962045D7968",
    formId: "E11",
    tableTitle: "2013 state budget expenditure execution by functional classification",
    actualAmountIndex: 1,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2013-fact.xlsx",
    workbookSourceId: "source.mof_2013_programmatic_fact_actual",
    finalSourceId: "source.mof_2013_expenditure_functional_plus_programmatic_supplement_actual",
  },  2014: {
    year: 2014,
    sourceId: "source.mof_2014_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2014-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "A09E932E6683CC2B7D55F01691841D5E393F376BD0A7013914D2E8B2CE18B23F",
    formId: "E11",
    tableTitle: "2014 state budget expenditure execution by functional classification",
    actualAmountIndex: 1,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2014-fact.xlsx",
    workbookSourceId: "source.mof_2014_programmatic_fact_actual",
    finalSourceId: "source.mof_2014_expenditure_functional_plus_programmatic_supplement_actual",
  },  2015: {
    year: 2015,
    sourceId: "source.mof_2015_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2015-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "ABDF59CF9192CFF61C8C619D1948777BBFB9F7D2606D6E1CD94D0E02769F80D6",
    formId: "E11",
    tableTitle: "2015 state budget expenditure execution by functional classification",
    actualAmountIndex: 1,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2015-fact.xlsx",
    workbookSourceId: "source.mof_2015_programmatic_fact_actual",
    finalSourceId: "source.mof_2015_expenditure_functional_plus_programmatic_supplement_actual",
  },  2016: {
    year: 2016,
    sourceId: "source.mof_2016_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2016-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "8F8509EB985AC16E52D02F08480B6374E368AEC3ED7E575B1BAA997A773E1127",
    formId: "E11",
    tableTitle: "2016 state budget expenditure execution by functional classification",
    actualAmountIndex: 1,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2016-fact.xlsx",
    workbookSourceId: "source.mof_2016_programmatic_fact_actual",
    finalSourceId: "source.mof_2016_expenditure_functional_plus_programmatic_supplement_actual",
  },  2017: {
    year: 2017,
    sourceId: "source.mof_2017_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2017-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "45DCDEBBB40647B8D9E4C57E8D52131B908B49D220B6BBF6F21BFFE3D7FFFF03",
    formId: "E11",
    tableTitle: "2017 state budget expenditure execution by functional classification",
    actualAmountIndex: 3,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2017-fact.xlsx",
    workbookSourceId: "source.mof_2017_programmatic_fact_actual",
    finalSourceId: "source.mof_2017_expenditure_functional_plus_programmatic_supplement_actual",
  },  2018: {
    year: 2018,
    sourceId: "source.mof_2018_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2018-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "F45968C139D9EA89D396BA1B1196D62A97CEBF50FE35201277048E6446F8AA94",
    formId: "E11",
    tableTitle: "2018 state budget expenditure execution by functional classification",
    actualAmountIndex: 3,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2018-fact.xlsx",
    workbookSourceId: "source.mof_2018_programmatic_fact_actual",
    finalSourceId: "source.mof_2018_expenditure_functional_plus_programmatic_supplement_actual",
  },  2019: {
    year: 2019,
    sourceId: "source.mof_2019_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2019-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "F0CBF895AA90510F48AA3DD6C04DC85F75F84736E116DCB81530D0EC5377D192",
    formId: "E11",
    tableTitle: "2019 state budget expenditure execution by functional classification",
    actualAmountIndex: 1,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2019-fact.xlsx",
    workbookSourceId: "source.mof_2019_programmatic_fact_actual",
    finalSourceId: "source.mof_2019_expenditure_functional_plus_programmatic_supplement_actual",
  },  2020: {
    year: 2020,
    sourceId: "source.mof_2020_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2020-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "01655B1F93B62FC0B7B13FB38EFE4E1D6C0AFA3BBCEC3BE8930295F5E4191916",
    formId: "E11",
    tableTitle: "2020 state budget expenditure execution by functional classification",
    actualAmountIndex: 1,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2020-fact.xlsx",
    workbookSourceId: "source.mof_2020_programmatic_fact_actual",
    finalSourceId: "source.mof_2020_expenditure_functional_plus_programmatic_supplement_actual",
  },  2021: {
    year: 2021,
    sourceId: "source.mof_2021_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2021-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "1135A9CD12B356D159C3C6AD623AA2369E594FA5AD6F94B8FAA1C024BC76EA9D",
    formId: "E11",
    tableTitle: "2021 state budget expenditure execution by functional classification",
    actualAmountIndex: 1,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2021-fact.xlsx",
    workbookSourceId: "source.mof_2021_programmatic_fact_actual",
    finalSourceId: "source.mof_2021_expenditure_functional_plus_programmatic_supplement_actual",
  },  2022: {
    year: 2022,
    sourceId: "source.mof_2022_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2022-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "07E7F03F44F81CC203B71B003F223B0A359E71E226B618A88F2D648FD35084F5",
    formId: "E11",
    tableTitle: "2022 state budget expenditure execution by functional classification",
    actualAmountIndex: 1,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2022-fact.xlsx",
    workbookSourceId: "source.mof_2022_programmatic_fact_actual",
    finalSourceId: "source.mof_2022_expenditure_functional_plus_programmatic_supplement_actual",
  },  2023: {
    year: 2023,
    sourceId: "source.mof_2023_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2023-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "C20E1BF832E964C48F62461F0C9AF92274ECA7C54A93A735D1442698013A7330",
    formId: "E11",
    tableTitle: "2023 state budget expenditure execution by functional classification",
    actualAmountIndex: 1,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2023-fact.xlsx",
    workbookSourceId: "source.mof_2023_programmatic_fact_actual",
    finalSourceId: "source.mof_2023_expenditure_functional_plus_programmatic_supplement_actual",
  },  2024: {
    year: 2024,
    sourceId: "source.mof_2024_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2024-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "DAA2BD22D7F0A43BF7738EA288FA159BB43C3F6F7228D3A9B4CADEB7835BCEC3",
    formId: "E11",
    tableTitle: "2024 state budget expenditure execution by functional classification",
    actualAmountIndex: 1,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2024-fact.xlsx",
    workbookSourceId: "source.mof_2024_programmatic_fact_actual",
    finalSourceId: "source.mof_2024_expenditure_functional_plus_programmatic_supplement_actual",
  },  2025: {
    year: 2025,
    sourceId: "source.mof_2025_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2025-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "1B680A253394C689703BE0279F41860AFEB6EF8D6791D5E42F5BE8C70FF39EAD",
    formId: "E11",
    tableTitle: "2025 state budget expenditure execution by functional classification",

    workbookPath: "docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2025-fact.xlsx",
    workbookSourceId: "source.mof_2025_programmatic_fact_actual",
    finalSourceId: "source.mof_2025_expenditure_functional_plus_programmatic_supplement_actual",
  },} as const;

type ReviewMappingCsvRow = {
  year: string;
  code: string;
  label_ka: string;
  actual_gel: string;
  mapping_confidence: "high" | "medium" | "low" | "unclassified";
  reviewed_public_spending_field_id: string;
  review_notes: string;
};

type SpendingField = {
  id: string;
  side: string;
};

type ExpenditureSourceYear = keyof typeof sourcesByYear;

function requestedYear(): ExpenditureSourceYear {
  const yearFlagIndex = process.argv.indexOf("--year");
  const rawYear = yearFlagIndex >= 0 ? process.argv[yearFlagIndex + 1] : process.argv[2];
  const year = rawYear ? Number(rawYear) : 2025;
  if (!(year in sourcesByYear) || !EXPENDITURE_DETAILED_YEARS.includes(year)) {
    throw new Error(`Unsupported detailed expenditure year for current coverage: ${rawYear}`);
  }
  return year as ExpenditureSourceYear;
}

const source = sourcesByYear[requestedYear()];
const outputFiles = finalExpenditureOutputFiles(source.year);

function repoPath(relativePath: string): string {
  return path.resolve(process.cwd(), "../..", relativePath);
}

function normalizeSheetName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function pickTavi6Sheet(workbook: XLSX.WorkBook): string {
  const sheetName =
    workbook.SheetNames.find((name) => {
      const normalized = normalizeSheetName(name);
      return normalized.includes("tavi 6") || normalized.includes("tavi vi") || normalized.includes("vi თავი");
    }) ??
    workbook.SheetNames.find((name) => normalizeSheetName(name) === "vi") ??
    workbook.SheetNames[0];
  if (!sheetName) throw new Error(`Could not find ${source.year} workbook sheet.`);
  return sheetName;
}

async function readCsv<T>(relativePath: string): Promise<T[]> {
  const text = await readFile(repoPath(relativePath), "utf8");
  return parse(text, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
  }) as T[];
}

function readWorkbookRows(): ReturnType<typeof parseAdminWorkbookRows> {
  const workbook = XLSX.readFile(repoPath(source.workbookPath), { cellDates: false });
  const sheetName = pickTavi6Sheet(workbook);
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Missing selected workbook sheet: ${sheetName}`);

  const matrix = XLSX.utils.sheet_to_json<MatrixCell[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: null,
    raw: true,
  });

  return parseAdminWorkbookRows({
    year: source.year,
    sourceId: source.workbookSourceId,
    workbookPath: source.workbookPath,
    sheetName,
    matrix,
  });
}

function workbookRowsToSupplementRows(rows: ReturnType<typeof parseAdminWorkbookRows>): WorkbookStagingRow[] {
  return rows.map((row) => ({
    year: row.year,
    sourceId: row.sourceId,
    code: row.code,
    isCodedRow: row.isCodedRow,
    isLeafCode: row.isLeafCode,
    labelKa: row.labelKa,
    actualGel: Math.round(row.actualThousandGel * 1000),
  }));
}

function mappingsByCode(rows: ReviewMappingCsvRow[]): Map<string, SupplementMapping> {
  return new Map(
    rows
      .filter((row) => row.year === String(source.year) && row.reviewed_public_spending_field_id)
      .map((row) => [
        row.code,
        {
          publicSpendingFieldId: row.reviewed_public_spending_field_id,
          mappingConfidence: row.mapping_confidence,
          labelKa: row.label_ka,
          mappingNotes: row.review_notes,
        },
      ]),
  );
}

function reviewedMappingsByLabel(rows: ReviewMappingCsvRow[]): Map<string, SupplementMapping> {
  const mappings = new Map<string, SupplementMapping>();

  for (const row of rows.filter(
    (candidate) =>
      candidate.reviewed_public_spending_field_id &&
      candidate.reviewed_public_spending_field_id !== "spending.other_unclassified",
  )) {
    if (mappings.has(row.label_ka)) continue;
    mappings.set(row.label_ka, {
      publicSpendingFieldId: row.reviewed_public_spending_field_id,
      mappingConfidence: row.mapping_confidence,
      labelKa: row.label_ka,
      mappingNotes: `Propagated from reviewed 2023-2025 row by exact Georgian label match: ${row.review_notes}`,
    });
  }

  return mappings;
}

function supplementMappingsByCode(input: {
  reviewRows: ReviewMappingCsvRow[];
  workbookRows: ReturnType<typeof parseAdminWorkbookRows>;
}): Map<string, SupplementMapping> {
  const mappings = mappingsByCode(input.reviewRows);
  const mappingsByLabel = reviewedMappingsByLabel(input.reviewRows);

  for (const row of generateCandidateMappings(input.workbookRows)) {
    if (mappings.has(row.code)) continue;
    const reviewedMapping = mappingsByLabel.get(row.labelKa);
    if (reviewedMapping) {
      mappings.set(row.code, reviewedMapping);
      continue;
    }
    mappings.set(row.code, {
      publicSpendingFieldId: row.suggestedPublicSpendingFieldId,
      mappingConfidence: row.mappingConfidence,
      labelKa: row.labelKa,
      mappingNotes: `Generated older-year supplement mapping candidate: ${row.mappingReason}`,
    });
  }

  return mappings;
}

async function loadSpendingFieldIds(): Promise<string[]> {
  const content = await readFile(repoPath("data/taxonomy/spending-fields.json"), "utf8");
  const fields = JSON.parse(content) as SpendingField[];
  return fields.filter((field) => field.side === "expenditure").map((field) => field.id);
}

function workbookTotalGelFromParsedRows(rows: ReturnType<typeof parseAdminWorkbookRows>): number {
  const totalRow = rows.find((row) => row.isTotal && row.code === "00 00");
  if (totalRow) return Math.round(totalRow.actualThousandGel * 1000);

  const topLevelRows = rows.filter((row) => row.code && !row.parentCode);
  if (topLevelRows.length > 0) {
    return Math.round(topLevelRows.reduce((sum, row) => sum + row.actualThousandGel * 1000, 0));
  }

  throw new Error(`Could not infer ${source.year} workbook total from raw workbook.`);
}

async function writeText(relativePath: string, content: string): Promise<void> {
  const filePath = repoPath(relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

async function main() {
  const actualSha256 = await sha256File(`../../${source.sourceFile}`);
  if (actualSha256 !== source.sourceSha256) {
    throw new Error(`Source PDF hash mismatch. Expected ${source.sourceSha256}, got ${actualSha256}`);
  }

  const pdf = await readPdfTextPages(repoPath(source.sourceFile));
  const pdfRows = parseExpenditurePdfText({
    ...source,
    pages: pdf.pages,
  });
  const pdfMappings = generateCompactPdfSpendingMappings(pdfRows);
  const pdfValidation = validateCompactPdfSpendingMappings(pdfRows, pdfMappings);

  if (pdfValidation.status === "failed") {
    throw new Error(
      `PDF mapping validation failed: mapped ${pdfValidation.mappedTotalActualGel}, grand total ${pdfValidation.grandTotalActualGel}`,
    );
  }

  const reviewMappingRows = await readCsv<ReviewMappingCsvRow>(
    "data/mappings/review/spending-field-mapping-review-2023-2025.csv",
  );
  const workbookRows = readWorkbookRows();
  const supplementMappings = supplementMappingsByCode({
    reviewRows: reviewMappingRows,
    workbookRows,
  });
  const supplements = extractFinancialAssetAndLiabilitySupplements({
    rows: workbookRowsToSupplementRows(workbookRows),
    mappingsByCode: supplementMappings,
  });
  const generatedSupplementMappingRows = supplements.filter((row) =>
    row.mappingNotes.startsWith("Generated older-year supplement mapping candidate:"),
  ).length;
  const result = composeFinalExpenditureFacts({
    year: source.year,
    finalSourceId: source.finalSourceId,
    sourceFiles: [
      source.sourceFile,
      source.workbookPath,
      "data/mappings/review/spending-field-mapping-review-2023-2025.csv",
      ...(generatedSupplementMappingRows > 0 ? ["apps/web/lib/data/realExpenditure/candidateMapping.ts"] : []),
    ],
    pdfMappings,
    supplements,
    spendingFieldIds: await loadSpendingFieldIds(),
    workbookTotalGel: workbookTotalGelFromParsedRows(workbookRows),
  });

  if (generatedSupplementMappingRows > 0) {
    result.report.notes.push(
      `${generatedSupplementMappingRows} workbook supplement rows used generated older-year mapping candidates where no reviewed 2023-2025 code mapping existed.`,
    );
  }
  if (result.report.differenceGel > 1000) {
    result.report.notes.push(
      `Final reconciliation failed tolerance: final total differs from workbook total by ${result.report.differenceGel} GEL.`,
    );
  }

  await writeText(outputFiles.factsCsv, final2025ExpenditureFactsToCsv(result.facts));
  await writeText(outputFiles.supplementCsv, final2025SupplementsToCsv(supplements));
  await writeText(outputFiles.reportJson, `${JSON.stringify(result.report, null, 2)}\n`);

  if (result.report.differenceGel > 1000) {
    throw new Error(`Final ${source.year} data reconciliation failed by ${result.report.differenceGel} GEL`);
  }

  console.log(`Final ${source.year} expenditure rows: ${result.facts.length}`);
  console.log(`PDF mapped total GEL: ${result.report.pdfMappedTotalGel}`);
  console.log(`Supplement total GEL: ${result.report.supplementTotalGel}`);
  console.log(`Final total GEL: ${result.report.finalTotalGel}`);
  console.log(`Workbook total GEL: ${result.report.workbookTotalGel}`);
  console.log(`Facts CSV: ${outputFiles.factsCsv}`);
  console.log(`Supplement CSV: ${outputFiles.supplementCsv}`);
  console.log(`Report JSON: ${outputFiles.reportJson}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
