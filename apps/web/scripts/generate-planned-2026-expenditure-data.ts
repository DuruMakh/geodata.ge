import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { lawFunctionalRows, lawTavi6OfficialRows } from "../lib/data/budgetLaw/lawRows";
import { readDocxTables } from "../lib/data/budgetLaw/readDocxTables";
import { BUDGET_LAW_2026 } from "../lib/data/budgetLaw/sources";
import { readCsvRecords } from "../lib/data/csv";
import {
  composeFinalExpenditureFacts,
  extractFinancialAssetAndLiabilitySupplements,
  final2025ExpenditureFactsToCsv,
  final2025SupplementsToCsv,
} from "../lib/data/realExpenditurePdf/final2025Data";
import { repoPath } from "../lib/data/realExpenditurePdf/expenditureSourcesByYear";
import { sha256File } from "../lib/data/realExpenditurePdf/phase1Pilot";
import {
  budgetLawArticle9ExtraMappingRules,
  generateCompactPdfSpendingMappings,
  validateCompactPdfSpendingMappings,
} from "../lib/data/realExpenditurePdf/publicMapping";
import {
  supplementMappingsByCode,
  workbookRowsToSupplementRows,
  type ReviewMappingCsvRow,
} from "../lib/data/realExpenditurePdf/supplementMappings";
import { loadTaxonomyFiles } from "../lib/data/taxonomy";

const year = 2026;
const lawDirectory = "docs/Raw Data/Expenditure/mof.ge/budget-law-2026";
const tavi3OriginalPath = `${lawDirectory}/2026-tavi-III.doc`;
const tavi6Path = `${lawDirectory}/2026-tavi-VI.docx`;
const tavi3ConvertedPath = "data/staging/budget-law-2026/2026-tavi-III.docx";
const reviewMappingPath = "data/mappings/review/spending-field-mapping-review-2023-2025.csv";
const outputFiles = {
  factsCsv: "data/imports/expenditure-facts-2026-planned.csv",
  supplementCsv: "data/staging/expenditure-2026-planned-financial-assets-liabilities-supplement.csv",
  reportJson: "data/reports/expenditure-planned-2026-report.json",
} as const;

async function assertSha256(relativePath: string, expected: string) {
  const actual = await sha256File(repoPath(relativePath));
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`Hash mismatch for ${relativePath}. Expected ${expected}, got ${actual}`);
  }
}

async function writeText(relativePath: string, content: string): Promise<void> {
  const filePath = repoPath(relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

async function main() {
  await assertSha256(tavi3OriginalPath, BUDGET_LAW_2026.tavi3Sha256);
  await assertSha256(tavi6Path, BUDGET_LAW_2026.tavi6Sha256);
  const provenance = JSON.parse(await readFile(`${BUDGET_LAW_2026.tavi3DocxPath}.provenance.json`, "utf8")) as {
    convertedSha256: string;
  };
  await assertSha256(tavi3ConvertedPath, provenance.convertedSha256);

  const article9Table = readDocxTables(BUDGET_LAW_2026.tavi3DocxPath).find((table) => table.some((row) => row[0] === "7"));
  if (!article9Table) throw new Error("Tavi III has no Article 9 functional table (no code 7 row).");
  const lawRows = lawFunctionalRows(article9Table, "plan2026");
  const lawMappings = generateCompactPdfSpendingMappings(lawRows, budgetLawArticle9ExtraMappingRules);
  const lawValidation = validateCompactPdfSpendingMappings(lawRows, lawMappings);
  if (lawValidation.status === "failed") {
    throw new Error(
      `Law Article 9 mapping validation failed: mapped ${lawValidation.mappedTotalActualGel}, grand total ${lawValidation.grandTotalActualGel}`,
    );
  }

  const workbookRows = lawTavi6OfficialRows();
  const totalRow = workbookRows.find((row) => row.isTotal && row.code === "00 00");
  if (!totalRow) throw new Error("Tavi VI has no 00 00 grand total row.");

  const supplements = extractFinancialAssetAndLiabilitySupplements({
    rows: workbookRowsToSupplementRows(workbookRows),
    mappingsByCode: supplementMappingsByCode({
      year,
      reviewRows: (await readCsvRecords(`../../${reviewMappingPath}`)) as ReviewMappingCsvRow[],
      workbookRows,
    }),
  });
  const generatedSupplementMappingRows = supplements.filter((row) =>
    row.mappingNotes.startsWith("Generated older-year supplement mapping candidate:"),
  ).length;
  const spendingFieldIds = (await loadTaxonomyFiles("../../data/taxonomy"))
    .filter((item) => item.side === "expenditure")
    .map((item) => item.id);
  const result = composeFinalExpenditureFacts({
    year,
    finalSourceId: BUDGET_LAW_2026.sourceId,
    sourceFiles: [
      tavi3OriginalPath,
      tavi3ConvertedPath,
      tavi6Path,
      reviewMappingPath,
      ...(generatedSupplementMappingRows > 0 ? ["apps/web/lib/data/realExpenditure/candidateMapping.ts"] : []),
    ],
    pdfMappings: lawMappings,
    supplements,
    spendingFieldIds,
    workbookTotalGel: Math.round(totalRow.actualThousandGel * 1000),
    basis: "planned",
  });

  if (generatedSupplementMappingRows > 0) {
    result.report.notes.push(
      `${generatedSupplementMappingRows} Tavi VI supplement rows used generated supplement mapping candidates where no reviewed code or label mapping existed.`,
    );
  }
  if (result.report.differenceGel > 1000) {
    result.report.notes.push(
      `Planned reconciliation failed tolerance: total differs from the Tavi VI 00 00 total by ${result.report.differenceGel} GEL.`,
    );
  }

  await writeText(outputFiles.factsCsv, final2025ExpenditureFactsToCsv(result.facts));
  await writeText(outputFiles.supplementCsv, final2025SupplementsToCsv(supplements));
  await writeText(outputFiles.reportJson, `${JSON.stringify(result.report, null, 2)}\n`);

  if (result.report.differenceGel > 1000) {
    throw new Error(`Planned ${year} data reconciliation failed by ${result.report.differenceGel} GEL`);
  }

  console.log(`Planned ${year} expenditure rows: ${result.facts.length}`);
  console.log(`Law Article 9 mapped total GEL: ${result.report.pdfMappedTotalGel}`);
  console.log(`Supplement total GEL: ${result.report.supplementTotalGel}`);
  console.log(`Planned total GEL: ${result.report.finalTotalGel}`);
  console.log(`Tavi VI total GEL: ${result.report.workbookTotalGel}`);
  console.log(`Facts CSV: ${outputFiles.factsCsv}`);
  console.log(`Supplement CSV: ${outputFiles.supplementCsv}`);
  console.log(`Report JSON: ${outputFiles.reportJson}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
