import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BudgetFactCsvRow } from "../lib/data/factCsv";
import {
  final2025ExpenditureFactsToCsv,
  finalExpenditureOutputFiles,
} from "../lib/data/realExpenditurePdf/final2025Data";
import { readPdfTextPages, sha256File } from "../lib/data/realExpenditurePdf/phase1Pilot";
import {
  assertOldClassificationReconciled,
  oldClassificationReviewRowsToCsv,
  parseOldClassificationExpenditure,
  type OldClassificationDialect,
} from "../lib/data/realExpenditurePdf/oldClassificationExpenditurePdf";

const sourcesByYear = {
  2005: {
    year: 2005,
    sourceId: "source.mof_2005_expenditure_pdf_form_e11_actual",
    finalSourceId: "source.mof_2005_expenditure_functional_old_classification_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2005-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "BFC38ACBD91515A224AC9148635537C163662D4BB36E2AD28C963D33FA4F9622",
    dialect: "translit_2005" as OldClassificationDialect,
    // "sul saxelmwifo biujetis gadasaxdelebi da xarjebi" payments column
    officialTotalGel: 2_626_507_300,
  },
  2006: {
    year: 2006,
    sourceId: "source.mof_2006_expenditure_pdf_form_e11_actual",
    finalSourceId: "source.mof_2006_expenditure_functional_old_classification_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2006-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "5088EDA02D6C4DA13B3D2C70E7C6C8781C41207DAEB3538E033B34F5EADF6EF2",
    dialect: "unicode_2006" as OldClassificationDialect,
    // grand "გადასახდელები" actual (report doc 8905: 3,822,512.6 thousand GEL)
    officialTotalGel: 3_822_512_626,
  },
} as const;

type OldYear = keyof typeof sourcesByYear;

function requestedYear(): OldYear {
  const yearFlagIndex = process.argv.indexOf("--year");
  const rawYear = yearFlagIndex >= 0 ? process.argv[yearFlagIndex + 1] : process.argv[2];
  const year = rawYear ? Number(rawYear) : NaN;
  if (!(year in sourcesByYear)) {
    throw new Error(`Unsupported old-classification year: ${rawYear} (expected 2005 or 2006)`);
  }
  return year as OldYear;
}

const source = sourcesByYear[requestedYear()];
const outputFiles = finalExpenditureOutputFiles(source.year);
const reviewCsvPath = `data/mappings/review/spending-field-mapping-review-${source.year}-old-classification.csv`;

function repoPath(relativePath: string): string {
  return path.resolve(process.cwd(), "../..", relativePath);
}

async function loadExpenditureSpendingFieldIds(): Promise<string[]> {
  const content = await readFile(repoPath("data/taxonomy/spending-fields.json"), "utf8");
  const fields = JSON.parse(content) as Array<{ id: string; side: string }>;
  return fields.filter((field) => field.side === "expenditure").map((field) => field.id);
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
  const result = parseOldClassificationExpenditure({
    year: source.year,
    sourceId: source.finalSourceId,
    dialect: source.dialect,
    officialTotalGel: source.officialTotalGel,
    pages: pdf.pages,
  });
  assertOldClassificationReconciled(result);

  const spendingFieldIds = await loadExpenditureSpendingFieldIds();
  const facts: BudgetFactCsvRow[] = spendingFieldIds.map((fieldId) => ({
    year: source.year,
    side: "expenditure",
    item_id: fieldId,
    amount_gel: String(result.categoryTotalsGel.get(fieldId) ?? 0),
    basis: "actual",
    source_id: source.finalSourceId,
    official_institution: "Old 14-group functional classification",
    official_program: "",
    official_subprogram: "",
    public_spending_field_id: fieldId,
    mapping_confidence: "medium",
    mapping_notes: "Pre-COFOG old-classification group mapped to public category; see old-classification review CSV.",
  }));

  const finalTotalGel = facts.reduce((sum, row) => sum + Number(row.amount_gel), 0);
  if (Math.abs(finalTotalGel - source.officialTotalGel) > 1000) {
    throw new Error(`Final ${source.year} category total ${finalTotalGel} differs from official ${source.officialTotalGel}`);
  }

  await writeText(outputFiles.factsCsv, final2025ExpenditureFactsToCsv(facts));
  await writeText(reviewCsvPath, oldClassificationReviewRowsToCsv(result.reviewRows));
  await writeText(
    outputFiles.reportJson,
    `${JSON.stringify(
      {
        year: source.year,
        finalSourceId: source.finalSourceId,
        grandTotalGel: result.grandTotalGel,
        officialTotalGel: result.officialTotalGel,
        differenceGel: result.differenceGel,
        finalTotalGel,
        categoryCount: spendingFieldIds.length,
        categoryTotalsGel: Object.fromEntries(result.categoryTotalsGel),
        reviewRowCount: result.reviewRows.length,
        sources: [source.sourceFile],
        notes: [
          "Pre-COFOG 14-group functional classification mapped to public spending categories.",
          "Group total minus carve-outs (sport, environment, debt operations, intergovernmental transfers).",
        ],
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Final ${source.year} old-classification rows: ${facts.length}`);
  console.log(`Grand total GEL: ${result.grandTotalGel}`);
  console.log(`Official total GEL: ${result.officialTotalGel}`);
  console.log(`Difference GEL: ${result.differenceGel}`);
  console.log(`Facts CSV: ${outputFiles.factsCsv}`);
  console.log(`Review CSV: ${reviewCsvPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
