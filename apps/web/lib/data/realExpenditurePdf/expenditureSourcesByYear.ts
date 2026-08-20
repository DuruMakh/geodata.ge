import path from "node:path";
import * as XLSX from "xlsx";
import { EXPENDITURE_DETAILED_YEARS } from "../coverage";

// Per-year provenance for the detailed expenditure pipeline: source ids, raw
// file paths, SHA-256 digests, parser flags and supplement blocks. This table
// and the three helpers below were duplicated verbatim between
// scripts/extract-expenditure-pdf-pilot.ts and
// scripts/generate-final-2025-expenditure-data.ts. Both scripts hash-compare
// every source before parsing, so a half-updated digest fails loudly rather
// than silently — but pickTavi6Sheet had already drifted between the copies,
// which would not have failed loudly. One definition, imported by both.
// 2005-2025 E11-era registry. The 2004 complete state-budget annex has a
// distinct old-classification parser in year2004StateBudget.ts, so it does not
// belong in this E11/supplement configuration table.
export const expenditureSourcesByYear = {
  2005: {
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
    nonDottedCodes: true,
    inlineFunctionalRows: true,
    canonicalizeLabels: true,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2007-annual-execution-report.pdf",
    // The 2007 E11 (old economic classification) already spans the whole
    // payments concept — lending and debt repayment print inside the
    // functional blocks — so there are no supplement rows; the execution
    // report only provides the official total to reconcile against.
    aggregateSupplements: {
      paymentsTotalThousandGel: 5237131.1,
      items: [],
    },
    workbookSourceId: "source.mof_2007_execution_report_total_actual",
    finalSourceId: "source.mof_2007_expenditure_functional_actual",
  },  2008: {
    year: 2008,
    sourceId: "source.mof_2008_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2008-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "268178E50F8697B584C87B1E18C0DF766167FEF822B157FF3BB3EEF08FF2C744",
    formId: "E11",
    tableTitle: "2008 state budget expenditure execution by functional classification",
    actualAmountIndex: 1,
    nonDottedCodes: true,
    inlineFunctionalRows: true,
    canonicalizeLabels: true,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2008-annual-execution-report.pdf",
    // The 2008 report itemizes financial assets growth and liabilities
    // decrease only at whole-budget level (Tavi I balance and the
    // financial-assets/liabilities chapter, report pages 109-110).
    aggregateSupplements: {
      paymentsTotalThousandGel: 6758831.8,
      items: [
        { code: "FIN-LOANS", labelKa: "სესხები (ფინანსური აქტივების ზრდა)", kind: "fin", amountThousandGel: 142620.2 },
        { code: "FIN-EQUITY", labelKa: "აქციები და სხვა კაპიტალი (ფინანსური აქტივების ზრდა)", kind: "fin", amountThousandGel: 57092.9 },
        { code: "LIAB-EXT", labelKa: "სახელმწიფო ვალდებულებების დაფარვა - საგარეო", kind: "liab", amountThousandGel: 58633.3 },
        { code: "LIAB-DOM", labelKa: "სახელმწიფო ვალდებულებების დაფარვა - საშინაო", kind: "liab", amountThousandGel: 52400.0 },
      ],
    },
    workbookSourceId: "source.mof_2008_execution_report_aggregate_actual",
    finalSourceId: "source.mof_2008_expenditure_functional_plus_execution_report_supplement_actual",
  },  2009: {
    year: 2009,
    sourceId: "source.mof_2009_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2009-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "C3558042D58E1E9D2CE3E1C8169DB4276B96294931D356107D01D8ADD24E8C63",
    formId: "E11",
    tableTitle: "2009 state budget expenditure execution by functional classification",
    actualAmountIndex: 1,
    nonDottedCodes: true,
    inlineFunctionalRows: true,
    canonicalizeLabels: true,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2009-annual-execution-report.pdf",
    legacyAnnualReport: {
      dialect: "translit",
      orgChapterPageRange: [53, 141],
      officialTotals: {
        paymentsTotalThousandGel: 6754106.8,
        financialAssetsGrowthThousandGel: 130842.8,
        liabilitiesDecreaseThousandGel: 348995.5,
      },
    },
    workbookSourceId: "source.mof_2009_organizational_fact_actual",
    finalSourceId: "source.mof_2009_expenditure_functional_plus_execution_report_supplement_actual",
  },  2010: {
    year: 2010,
    sourceId: "source.mof_2010_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2010-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "F98A74D4869037398DD83C09DF1BBE3B90EFE97B90F8F5FBB567720CC0B934FF",
    formId: "E11",
    tableTitle: "2010 state budget expenditure execution by functional classification",
    actualAmountIndex: 1,
    nonDottedCodes: true,
    inlineFunctionalRows: true,
    canonicalizeLabels: true,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2010-annual-execution-report.pdf",
    legacyAnnualReport: {
      dialect: "translit",
      orgChapterPageRange: [47, 118],
      officialTotals: {
        paymentsTotalThousandGel: 6972343.8,
        financialAssetsGrowthThousandGel: 314287.8,
        liabilitiesDecreaseThousandGel: 171324.0,
      },
    },
    workbookSourceId: "source.mof_2010_organizational_fact_actual",
    finalSourceId: "source.mof_2010_expenditure_functional_plus_execution_report_supplement_actual",
  },  2011: {
    year: 2011,
    sourceId: "source.mof_2011_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2011-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "5D9726640265EA1882C9F08DD3F234BBE31F9B7DF928A3BB80C6B9F4DD27480D",
    formId: "E11",
    tableTitle: "2011 state budget expenditure execution by functional classification",
    actualAmountIndex: 1,
    nonDottedCodes: true,
    inlineFunctionalRows: true,
    canonicalizeLabels: true,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2011-annual-execution-report.pdf",
    legacyAnnualReport: {
      dialect: "unicode",
      orgChapterPageRange: [69, 165],
      officialTotals: {
        paymentsTotalThousandGel: 7459279.5,
        financialAssetsGrowthThousandGel: 429976.5,
        liabilitiesDecreaseThousandGel: 166378.2,
      },
    },
    workbookSourceId: "source.mof_2011_organizational_fact_actual",
    finalSourceId: "source.mof_2011_expenditure_functional_plus_execution_report_supplement_actual",
  },  2012: {
    year: 2012,
    sourceId: "source.mof_2012_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2012-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "8509167D1D564218B9B8BAEC3455437F4D82E417D45176B8608D3CCA623DDD4F",
    formId: "E11",
    tableTitle: "2012 state budget expenditure execution by functional classification",
    actualAmountIndex: 3,
    nonDottedCodes: true,
    legacyEncodedLabels: true,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2012-annual-execution-report.pdf",
    workbookPageRange: [202, 249],
    workbookSourceId: "source.mof_2012_programmatic_fact_actual",
    finalSourceId: "source.mof_2012_expenditure_functional_plus_programmatic_supplement_actual",
  },  2013: {
    year: 2013,
    sourceId: "source.mof_2013_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2013-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "84088FD0EA3E944E5E5CBD865191D3D02228307C13B5F0877423C962045D7968",
    formId: "E11",
    tableTitle: "2013 state budget expenditure execution by functional classification",
    actualAmountIndex: 3,
    nonDottedCodes: true,
    legacyEncodedLabels: true,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/final-fact-files-2004-2025/2013-fact.pdf",
    workbookSourceId: "source.mof_2013_programmatic_fact_actual",
    finalSourceId: "source.mof_2013_expenditure_functional_plus_programmatic_supplement_actual",
  },  2014: {
    year: 2014,
    sourceId: "source.mof_2014_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2014-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "A09E932E6683CC2B7D55F01691841D5E393F376BD0A7013914D2E8B2CE18B23F",
    formId: "E11",
    tableTitle: "2014 state budget expenditure execution by functional classification",
    actualAmountIndex: 3,
    legacyEncodedLabels: true,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2014-annual-execution-tavi-VI-programmatic.pdf",
    workbookSourceId: "source.mof_2014_programmatic_fact_actual",
    finalSourceId: "source.mof_2014_expenditure_functional_plus_programmatic_supplement_actual",
  },  2015: {
    year: 2015,
    sourceId: "source.mof_2015_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2015-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "ABDF59CF9192CFF61C8C619D1948777BBFB9F7D2606D6E1CD94D0E02769F80D6",
    formId: "E11",
    tableTitle: "2015 state budget expenditure execution by functional classification",
    actualAmountIndex: 3,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2015-annual-execution-tavi-VI-programmatic.pdf",
    workbookSourceId: "source.mof_2015_programmatic_fact_actual",
    finalSourceId: "source.mof_2015_expenditure_functional_plus_programmatic_supplement_actual",
  },  2016: {
    year: 2016,
    sourceId: "source.mof_2016_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2016-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "8F8509EB985AC16E52D02F08480B6374E368AEC3ED7E575B1BAA997A773E1127",
    formId: "E11",
    tableTitle: "2016 state budget expenditure execution by functional classification",
    actualAmountIndex: 3,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2016-annual-execution-tavi-VI-programmatic.pdf",
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

export type ExpenditureSourceYear = keyof typeof expenditureSourcesByYear;

export function requestedYear(): ExpenditureSourceYear {
  const yearFlagIndex = process.argv.indexOf("--year");
  const rawYear = yearFlagIndex >= 0 ? process.argv[yearFlagIndex + 1] : process.argv[2];
  const year = rawYear ? Number(rawYear) : 2025;
  if (!(year in expenditureSourcesByYear) || !EXPENDITURE_DETAILED_YEARS.includes(year)) {
    throw new Error(`Unsupported detailed expenditure year for current coverage: ${rawYear}`);
  }
  return year as ExpenditureSourceYear;
}

export function repoPath(relativePath: string): string {
  return path.resolve(process.cwd(), "../..", relativePath);
}

function normalizeSheetName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

// The generator's variant, which the pilot's copy had drifted behind: it
// collapses inner whitespace and also accepts "tavi vi" and a bare "vi".
// On all 22 committed workbooks both variants resolve to the same sheet, so
// the drift was still latent — keeping the tolerant one loses nothing.
export function pickTavi6Sheet(workbook: XLSX.WorkBook, year: number): string {
  const sheetName =
    workbook.SheetNames.find((name) => {
      const normalized = normalizeSheetName(name);
      return normalized.includes("tavi 6") || normalized.includes("tavi vi") || normalized.includes("vi თავი");
    }) ??
    workbook.SheetNames.find((name) => normalizeSheetName(name) === "vi") ??
    workbook.SheetNames[0];
  if (!sheetName) throw new Error(`Could not find ${year} workbook sheet.`);
  return sheetName;
}
