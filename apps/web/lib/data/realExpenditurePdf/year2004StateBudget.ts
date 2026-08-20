import type { BudgetFactCsvRow } from "../factCsv";
import type { OldClassificationReviewRow } from "./oldClassificationExpenditurePdf";
import { readPdfTextPages, sha256File, type ExpenditurePdfPageText } from "./phase1Pilot";

export const year2004StateBudgetSources = {
  fullState: {
    sourceId: "source.mof_2004_expenditure_full_state_functional_actual",
    sourceFile: "docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2004-annual-execution-annex.pdf",
    sha256: "C999654E8C2A430778E48FE67C1BFC7D15DC30F76A60CEEF4477614A31849889",
  },
  centralSupporting: {
    sourceId: "source.mof_2004_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2004-12-month-state-budget-functional-expenditure.pdf",
    sha256: "33EE4A12881FB6AA6B3D7221ABBF8FEB61F1764B448B6F8A76155CC24AF67A97",
  },
} as const;

export type Year2004StateBudgetResult = {
  groupTotalsGel: Map<number, number>;
  categoryTotalsGel: Map<string, number>;
  reviewRows: OldClassificationReviewRow[];
  facts: BudgetFactCsvRow[];
  grandTotalGel: number;
  differenceGel: number;
  roundingAdjustmentGel: number;
};

const officialTotalGel = 1_930_210_300;

const dominantFieldByGroup: Record<number, string> = {
  1: "spending.general_public_services",
  2: "spending.defence",
  3: "spending.public_order_safety",
  4: "spending.education",
  5: "spending.health",
  6: "spending.social_protection",
  7: "spending.infrastructure_regional_development",
  8: "spending.culture",
  9: "spending.economic_affairs",
  10: "spending.agriculture_environment",
  11: "spending.economic_affairs",
  12: "spending.infrastructure_regional_development",
  13: "spending.economic_affairs",
  14: "spending.other_unclassified",
};

const groupLabelKa: Record<number, string> = {
  1: "საერთო დანიშნულების სახელმწიფო მომსახურება",
  2: "თავდაცვა",
  3: "საზოგადოებრივი წესრიგი და უშიშროება",
  4: "განათლება",
  5: "ჯანმრთელობის დაცვა",
  6: "სოციალური დაზღვევა და სოციალური უზრუნველყოფა",
  7: "საბინაო-კომუნალური მეურნეობა",
  8: "საქმიანობა კულტურის, სპორტისა და რელიგიის სფეროში",
  9: "სათბობ-ენერგეტიკული კომპლექსი",
  10: "სოფლის მეურნეობა, სატყეო მეურნეობა, მეთევზეობა და მონადირეობა",
  11: "სამთომომპოვებელი მრეწველობა და სასარგებლო წიაღისეული",
  12: "ტრანსპორტი და კავშირგაბმულობა",
  13: "ეკონომიკურ საქმიანობასთან დაკავშირებული სხვა საქმიანობა",
  14: "ხარჯები, რომელიც არ განეკუთვნება ძირითად განყოფილებებს",
};

const spendingFieldIds = [
  "spending.social_protection",
  "spending.health",
  "spending.education",
  "spending.defence",
  "spending.public_order_safety",
  "spending.infrastructure_regional_development",
  "spending.economic_affairs",
  "spending.agriculture_environment",
  "spending.culture",
  "spending.sport",
  "spending.general_public_services",
  "spending.debt_service",
  "spending.other_unclassified",
] as const;

function thousandGelToGel(value: string): number {
  return Math.round(Number(value.replaceAll(" ", "").replace(",", ".")) * 1000);
}

function completeStatePage(pages: ExpenditurePdfPageText[]): ExpenditurePdfPageText {
  const page = pages.filter((candidate) => candidate.pageNumber === 232);
  if (page.length !== 1) throw new Error(`Expected one 2004 full-state functional page 232, found ${page.length}`);
  return page[0];
}

function parseFullStateGroups(pages: ExpenditurePdfPageText[]): { groupTotalsGel: Map<number, number>; grandTotalGel: number } {
  const text = completeStatePage(pages).text;
  const groupTotalsGel = new Map<number, number>();
  const groupPattern = /^(\d{2}) 00 [\s\S]*?\nxarji ([\d ]+,\d)(?:\s|$)/gm;

  for (const match of text.matchAll(groupPattern)) {
    const group = Number(match[1]);
    if (groupTotalsGel.has(group)) {
      throw new Error(`Duplicate 2004 full-state functional group ${match[1]}`);
    }
    groupTotalsGel.set(group, thousandGelToGel(match[2]));
  }

  for (let group = 1; group <= 14; group += 1) {
    if (!groupTotalsGel.has(group)) {
      throw new Error(`Missing 2004 full-state functional group ${String(group).padStart(2, "0")}`);
    }
  }

  const grandMatch = text.match(/^sul saxelmwifo biujeti [^\n]*\nxarji ([\d ]+,\d)(?:\s|$)/m);
  if (!grandMatch) throw new Error("Missing 2004 full-state functional grand total");

  return { groupTotalsGel, grandTotalGel: thousandGelToGel(grandMatch[1]) };
}

function parseSupportingCentralParents(pages: ExpenditurePdfPageText[]): Map<number, number> {
  if (pages.length !== 1) throw new Error(`Expected one 2004 central functional page, found ${pages.length}`);
  const text = pages[0].text.replaceAll("\t", " ");
  const totals = new Map<number, number>();
  const pattern = /^(\d{2}) 00 [\s\S]*?\nsakaso xarji(?: sakaso xarji){3} ([\d,]+)/gm;

  for (const match of text.matchAll(pattern)) {
    const group = Number(match[1]);
    if (totals.has(group)) throw new Error(`Duplicate 2004 central functional group ${match[1]}`);
    totals.set(group, Number(match[2].replaceAll(",", "")));
  }

  for (const group of [8, 14]) {
    if (!totals.has(group)) {
      throw new Error(`Missing 2004 central functional supporting group ${String(group).padStart(2, "0")}`);
    }
  }
  return totals;
}

function detailedActualGel(pages: ExpenditurePdfPageText[], prefix: string): number {
  const amountsGel = pages
    .flatMap((page) => page.text.split(/\r?\n/))
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.match(/([\d ]+,\d) ([\d ]+,\d)$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => thousandGelToGel(match[2]));
  const uniqueAmountsGel = [...new Set(amountsGel)];

  if (uniqueAmountsGel.length !== 1) {
    throw new Error(
      `Expected one 2004 supporting detail amount for ${prefix}, found ${uniqueAmountsGel.length}`,
    );
  }
  return uniqueAmountsGel[0];
}

export function parseYear2004StateBudget(input: {
  annexPages: ExpenditurePdfPageText[];
  centralPages: ExpenditurePdfPageText[];
}): Year2004StateBudgetResult {
  const { groupTotalsGel, grandTotalGel } = parseFullStateGroups(input.annexPages);
  const centralParents = parseSupportingCentralParents(input.centralPages);

  if (Math.abs(centralParents.get(8)! - groupTotalsGel.get(8)!) > 1000) {
    throw new Error("2004 group 8 differs between full-state and central supporting tables beyond source rounding");
  }

  const sportGel = detailedActualGel(input.annexPages, "30 02 sportis departamenti ");
  const externalDebtGel = detailedActualGel(
    input.annexPages,
    "22 02 sagareo saxelmwifo valdebulebebis momsaxureba ",
  );
  const domesticDebtGel = detailedActualGel(
    input.annexPages,
    "22 03 saSinao saxelmwifo valdebulebebis momsaxureba ",
  );
  const intergovernmentalTransferGel = detailedActualGel(
    input.annexPages,
    "22 04 transferi teritoriuli erTeulebis biujetebSi ",
  );
  const debtGel = externalDebtGel + domesticDebtGel;

  const carveOuts = new Map<number, Array<{ field: string; amountGel: number; code: string; labelKa: string; reason: string }>>([
    [
      8,
      [
        {
          field: "spending.sport",
          amountGel: sportGel,
          code: "8.1.1",
          labelKa: "სპორტისა და დასვენების ორგანიზაცია",
          reason: "exact central-budget sport carve-out from the detailed execution annex",
        },
      ],
    ],
    [
      14,
      [
        {
          field: "spending.debt_service",
          amountGel: debtGel,
          code: "14.1.0",
          labelKa: "ოპერაციები სახელმწიფო ვალდებულებებით",
          reason: "exact external and domestic state-debt operations from the detailed execution annex",
        },
        {
          field: "spending.infrastructure_regional_development",
          amountGel: intergovernmentalTransferGel,
          code: "14.2.0",
          labelKa: "საერთო ხასიათის ტრანსფერები მმართველობის დონეებს შორის",
          reason: "exact central-to-territorial-budget transfer from the detailed execution annex",
        },
      ],
    ],
  ]);

  const categoryTotalsGel = new Map<string, number>();
  const reviewRows: OldClassificationReviewRow[] = [];
  const addCategory = (field: string, amountGel: number) => {
    categoryTotalsGel.set(field, (categoryTotalsGel.get(field) ?? 0) + amountGel);
  };

  for (let group = 1; group <= 14; group += 1) {
    const parentTotalGel = groupTotalsGel.get(group)!;
    const groupCarveOuts = carveOuts.get(group) ?? [];
    let remainderGel = parentTotalGel;

    for (const carveOut of groupCarveOuts) {
      remainderGel -= carveOut.amountGel;
      addCategory(carveOut.field, carveOut.amountGel);
      reviewRows.push({
        year: 2004,
        sourceId: year2004StateBudgetSources.fullState.sourceId,
        code: carveOut.code,
        labelKa: carveOut.labelKa,
        actualGel: carveOut.amountGel,
        publicSpendingFieldId: carveOut.field,
        mappingReason: carveOut.reason,
      });
    }

    if (remainderGel < 0) throw new Error(`2004 group ${group} carve-outs exceed its full-state parent total`);
    const dominantField = dominantFieldByGroup[group];
    addCategory(dominantField, remainderGel);
    reviewRows.push({
      year: 2004,
      sourceId: year2004StateBudgetSources.fullState.sourceId,
      code: `${group}.0.0`,
      labelKa: groupLabelKa[group],
      actualGel: remainderGel,
      publicSpendingFieldId: dominantField,
      mappingReason:
        groupCarveOuts.length > 0
          ? "complete state-budget group remainder after exact central supporting carve-outs"
          : "complete state-budget group mapped to its dominant public category",
    });
  }

  const mappedTotalBeforeRoundingGel = [...categoryTotalsGel.values()].reduce((sum, amount) => sum + amount, 0);
  const roundingAdjustmentGel = grandTotalGel - mappedTotalBeforeRoundingGel;
  if (Math.abs(roundingAdjustmentGel) > 1000) {
    throw new Error(`2004 group rounding adjustment ${roundingAdjustmentGel} exceeds GEL 1,000`);
  }
  if (roundingAdjustmentGel !== 0) {
    addCategory("spending.other_unclassified", roundingAdjustmentGel);
    const residualReviewRow = reviewRows.find((row) => row.code === "14.0.0");
    if (!residualReviewRow) throw new Error("Missing 2004 residual review row for rounding adjustment");
    residualReviewRow.actualGel += roundingAdjustmentGel;
    residualReviewRow.mappingReason += `; ${roundingAdjustmentGel} GEL source-table rounding reconciliation`;
  }

  const facts: BudgetFactCsvRow[] = spendingFieldIds.map((fieldId) => ({
    year: 2004,
    side: "expenditure",
    item_id: fieldId,
    amount_gel: String(categoryTotalsGel.get(fieldId) ?? 0),
    basis: "actual",
    source_id: year2004StateBudgetSources.fullState.sourceId,
    official_institution: "Old 14-group functional classification — complete state budget",
    official_program: "",
    official_subprogram: "",
    public_spending_field_id: fieldId,
    mapping_confidence: "medium",
    mapping_notes:
      fieldId === "spending.other_unclassified" && roundingAdjustmentGel !== 0
        ? `Complete state-budget parent mapped under the reviewed old-classification rules; ${roundingAdjustmentGel} GEL source-table rounding reconciliation retained in the residual; see review CSV.`
        : "Complete state-budget parent mapped under the reviewed old-classification rules; see review CSV.",
  }));
  const factTotalGel = facts.reduce((sum, row) => sum + Number(row.amount_gel), 0);

  if (grandTotalGel !== officialTotalGel || factTotalGel !== grandTotalGel) {
    throw new Error(
      `2004 full-state reconciliation failed: facts ${factTotalGel}, parsed grand ${grandTotalGel}, official ${officialTotalGel}`,
    );
  }

  return {
    groupTotalsGel,
    categoryTotalsGel,
    reviewRows,
    facts,
    grandTotalGel,
    differenceGel: Math.abs(grandTotalGel - officialTotalGel),
    roundingAdjustmentGel,
  };
}

export async function loadYear2004StateBudget(): Promise<Year2004StateBudgetResult> {
  for (const source of Object.values(year2004StateBudgetSources)) {
    const actualSha256 = await sha256File(`../../${source.sourceFile}`);
    if (actualSha256 !== source.sha256) {
      throw new Error(`Source PDF hash mismatch for ${source.sourceFile}. Expected ${source.sha256}, got ${actualSha256}`);
    }
  }

  const [annex, central] = await Promise.all([
    readPdfTextPages(`../../${year2004StateBudgetSources.fullState.sourceFile}`),
    readPdfTextPages(`../../${year2004StateBudgetSources.centralSupporting.sourceFile}`),
  ]);
  return parseYear2004StateBudget({ annexPages: annex.pages, centralPages: central.pages });
}
