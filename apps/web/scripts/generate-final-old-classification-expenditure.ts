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
import {
  loadYear2004StateBudget,
  year2004StateBudgetSources,
} from "../lib/data/realExpenditurePdf/year2004StateBudget";

const sourcesByYear = {
  2004: {
    kind: "complete_state_2004" as const,
    year: 2004,
    finalSourceId: "source.mof_2004_expenditure_full_state_functional_actual",
    officialTotalGel: 1_930_210_300,
  },
  2005: {
    kind: "old_classification" as const,
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
    kind: "old_classification" as const,
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
    throw new Error(`Unsupported old-classification year: ${rawYear} (expected 2004, 2005, or 2006)`);
  }
  return year as OldYear;
}

const source = sourcesByYear[requestedYear()];
const defaultOutputFiles = finalExpenditureOutputFiles(source.year);
const outputFiles =
  source.year === 2004
    ? { ...defaultOutputFiles, reportJson: "data/reports/expenditure-2004-final-report.json" }
    : defaultOutputFiles;
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
  if (source.kind === "complete_state_2004") {
    const result = await loadYear2004StateBudget();
    const finalTotalGel = result.facts.reduce((sum, row) => sum + Number(row.amount_gel), 0);

    await writeText(outputFiles.factsCsv, final2025ExpenditureFactsToCsv(result.facts));
    await writeText(reviewCsvPath, oldClassificationReviewRowsToCsv(result.reviewRows));
    await writeText(
      outputFiles.reportJson,
      `${JSON.stringify(
        {
          year: source.year,
          finalSourceId: source.finalSourceId,
          grandTotalGel: result.grandTotalGel,
          officialTotalGel: source.officialTotalGel,
          differenceGel: result.differenceGel,
          roundingAdjustmentGel: result.roundingAdjustmentGel,
          finalTotalGel,
          categoryCount: result.facts.length,
          groupTotalsGel: Object.fromEntries(result.groupTotalsGel),
          categoryTotalsGel: Object.fromEntries(result.categoryTotalsGel),
          reviewRowCount: result.reviewRows.length,
          sources: [
            year2004StateBudgetSources.fullState.sourceFile,
            year2004StateBudgetSources.centralSupporting.sourceFile,
          ],
          sourceRoles: {
            completeExecutionAnnex:
              "Supplies the full-state parent/grand totals and the exact central-budget detail rows used for carve-outs.",
            treasuryCentralE11:
              "Corroborates the narrower central-budget scope and parent aggregates only; supplies no review-row amount.",
          },
          scope: {
            publicFacts: "Complete 2004 state-budget actual from annex page 232.",
            supportingCarveOuts:
              "Exact sport, debt, and intergovernmental-transfer carve-outs come from central-budget detail rows inside the complete execution annex.",
            centralCorroboration:
              "The separate Treasury E11 PDF is used only for central-scope and parent-aggregate corroboration.",
            excluded:
              "The central-budget grand total is narrower than the complete state budget and is never emitted.",
          },
          notes: [
            "Pre-COFOG 14-group functional classification mapped to public spending categories.",
            "Complete state-budget group totals are never prorated; only exact source-backed carve-outs are subtracted.",
            `${result.roundingAdjustmentGel} GEL source-table rounding adjustment is retained in spending.other_unclassified.`,
          ],
        },
        null,
        2,
      )}\n`,
    );

    console.log(`Final ${source.year} old-classification rows: ${result.facts.length}`);
    console.log(`Grand total GEL: ${result.grandTotalGel}`);
    console.log(`Official total GEL: ${source.officialTotalGel}`);
    console.log(`Difference GEL: ${result.differenceGel}`);
    console.log(`Facts CSV: ${outputFiles.factsCsv}`);
    console.log(`Review CSV: ${reviewCsvPath}`);
    return;
  }

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
