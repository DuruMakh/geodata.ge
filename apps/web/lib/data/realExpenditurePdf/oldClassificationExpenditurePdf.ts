import type { ExpenditurePdfPageText } from "./phase1Pilot";

/**
 * Parser and public-category mapping for the pre-COFOG (2004-2006) treasury E11
 * tables, which use the old 14-group functional classification rather than
 * COFOG. Only 2005 and 2006 are wired: 2004 is central-budget-scoped and left
 * out for now.
 *
 * Layout differs by year:
 *  - 2006: Unicode Georgian labels, GEL amounts (two decimals), codes printed
 *    as "NN NN NN" alone on their own line, six amount columns, the actual
 *    payment ("გადასახდელები") at column index 2. Economic breakdown rows sit
 *    under each functional code and are ignored (only functional codes carry a
 *    code line).
 *  - 2005: legacy ASCII-transliteration font, thousand-GEL amounts (one
 *    decimal, "-" for zero), codes "NN"/"NN NN"/"NN NN NN" leading a line whose
 *    trailing seven cells are the columns, the actual payment at column index 1.
 *
 * The mapping is the old-classification analogue of the COFOG rules in
 * publicMapping.ts: each group maps to a dominant public category, and four
 * sub-codes are carved out to their own category (sport out of the culture
 * group; environment out of the mixed economic group; debt operations and
 * intergovernmental transfers out of the residual group). Allocation is
 * "group total minus carve-outs", so the category totals always sum to the
 * group totals, which in turn sum to the official grand total exactly.
 */

export type OldClassificationDialect = "unicode_2006" | "translit_2005";

export type OldClassificationSource = {
  year: number;
  sourceId: string;
  dialect: OldClassificationDialect;
  officialTotalGel: number;
};

export type OldClassificationReviewRow = {
  year: number;
  sourceId: string;
  code: string;
  labelKa: string;
  actualGel: number;
  publicSpendingFieldId: string;
  mappingReason: string;
};

export type OldClassificationResult = {
  categoryTotalsGel: Map<string, number>;
  reviewRows: OldClassificationReviewRow[];
  grandTotalGel: number;
  officialTotalGel: number;
  differenceGel: number;
};

const reconciliationToleranceGel = 1000;

// Old functional group -> dominant public spending field.
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

// Canonical Georgian group labels (from the 2006 Unicode E11).
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
  13: "გარემოსა და ბუნებრივი რესურსების დაცვა, ეკონომიკურ საქმიანობასთან დაკავშირებული სხვა საქმიანობა",
  14: "ხარჯები, რომელიც არ განეკუთვნება ძირითად განყოფილებებს",
};

type CarveOut = {
  codeKey: string;
  group: number;
  toField: string;
  labelKa: string;
  reason: string;
};

// Sub-codes lifted out of their group's dominant category.
const carveOuts: CarveOut[] = [
  {
    codeKey: "8.1.1",
    group: 8,
    toField: "spending.sport",
    labelKa: "სპორტისა და დასვენების ორგანიზაცია",
    reason: "sport carved out of the culture/sport/religion group (COFOG 7.8.1 convention)",
  },
  {
    codeKey: "13.5.0",
    group: 13,
    toField: "spending.agriculture_environment",
    labelKa: "გარემოსა და ბუნებრივი რესურსების დაცვა",
    reason: "environmental protection carved out of the mixed economic group (COFOG 7.5 convention)",
  },
  {
    codeKey: "14.1.0",
    group: 14,
    toField: "spending.debt_service",
    labelKa: "ოპერაციები სახელმწიფო ვალდებულებებით",
    reason: "state debt operations carved out of the residual group (COFOG 7.1.6 convention)",
  },
  {
    codeKey: "14.2.0",
    group: 14,
    toField: "spending.infrastructure_regional_development",
    labelKa: "საერთო ხასიათის ტრანსფერები მმართველობის დონეებს შორის",
    reason: "intergovernmental transfers carved out of the residual group (COFOG 7.1.7 convention)",
  },
];

function normalizeLine(line: string): string {
  return line.replace(/ /g, " ").replace(/\t/g, " ").replace(/\s+/g, " ").trim();
}

/** "08 00 00" / "08 01" / "8" -> "8.1.1"-style group.sub.leaf key. */
function codeKey(groups: string[]): string {
  const parts = groups.map((value) => Number(value));
  while (parts.length < 3) parts.push(0);
  return parts.slice(0, 3).join(".");
}

const unicodeHeaderPattern =
  /^(ÂÄÂÌÀ|ÓÔÀÍÃ|ÈÅÉÓ|\( ?ფუნქციონალურ|ფორმა|გვერდი \d|რი კოდი|ფუნქციონალუ|Ã À Ó|ÃÀÌÏßÌÄÁÀ|20\d\d$)/;
const unicodeAmountToken = /-?\d{1,3}(?:,\d{3})*\.\d{2}/g;

// 2006: bare "NN NN NN" code lines; the first six GEL amounts after a code are
// that row's six columns, payment at index 2.
function extractRows2006(pages: ExpenditurePdfPageText[]): Map<string, number> {
  const rows = new Map<string, number>();
  let active: { key: string; buffer: number[] } | null = null;

  const flush = () => {
    if (active && active.buffer.length >= 6 && !rows.has(active.key)) {
      rows.set(active.key, active.buffer[2]);
    }
    active = null;
  };

  for (const page of pages) {
    for (const raw of page.text.split(/\r?\n/)) {
      const line = normalizeLine(raw);
      if (!line || unicodeHeaderPattern.test(line)) continue;
      const codeMatch = line.match(/^(\d{2}) (\d{2}) (\d{2})$/);
      if (codeMatch) {
        flush();
        active = { key: codeKey([codeMatch[1], codeMatch[2], codeMatch[3]]), buffer: [] };
        continue;
      }
      if (active && active.buffer.length < 6) {
        for (const token of line.match(unicodeAmountToken) ?? []) {
          active.buffer.push(Number(token.replace(/,/g, "")));
        }
        if (active.buffer.length >= 6) flush();
      }
    }
  }
  flush();
  return rows;
}

const translitCellToken = /^(-|-?\d{1,3}(?:,\d{3})*\.\d)$/;

// 2005: a code "NN"/"NN NN"/"NN NN NN" starts a row; the trailing seven
// number-or-dash cells of the (possibly wrapped) row are the columns, thousand
// GEL, payment at index 1.
function extractRows2005(pages: ExpenditurePdfPageText[]): Map<string, number> {
  const rows = new Map<string, number>();
  let active: { key: string; words: string[] } | null = null;

  const flush = () => {
    if (!active) return;
    const trailing: string[] = [];
    for (let index = active.words.length - 1; index >= 0; index -= 1) {
      if (translitCellToken.test(active.words[index])) trailing.unshift(active.words[index]);
      else break;
    }
    if (trailing.length >= 7 && !rows.has(active.key)) {
      const columns = trailing.slice(-7).map((cell) => (cell === "-" ? 0 : Number(cell.replace(/,/g, "")) * 1000));
      rows.set(active.key, columns[1]);
    }
    active = null;
  };

  for (const page of pages) {
    for (const raw of page.text.split(/\r?\n/)) {
      const line = normalizeLine(raw);
      if (!line) continue;
      const codeMatch = line.match(/^(\d{2})(?: (\d{2}))?(?: (\d{2}))?\b(.*)$/);
      const remainder = codeMatch ? (codeMatch[4] ?? "").trim() : "";
      // A leading 2-digit token is a code only when it is not itself the start
      // of an amount cell (amount rows begin with a comma/decimal number).
      if (codeMatch && !/^[\d,]+\.\d/.test(remainder)) {
        flush();
        active = { key: codeKey([codeMatch[1], codeMatch[2] ?? "0", codeMatch[3] ?? "0"]), words: remainder.split(" ").filter(Boolean) };
        const trailing: string[] = [];
        for (let index = active.words.length - 1; index >= 0; index -= 1) {
          if (translitCellToken.test(active.words[index])) trailing.unshift(active.words[index]);
          else break;
        }
        if (trailing.length >= 7) flush();
        continue;
      }
      if (active) active.words.push(...line.split(" ").filter(Boolean));
    }
  }
  flush();
  return rows;
}

export function parseOldClassificationExpenditure(
  input: OldClassificationSource & { pages: ExpenditurePdfPageText[] },
): OldClassificationResult {
  const rows = input.dialect === "unicode_2006" ? extractRows2006(input.pages) : extractRows2005(input.pages);

  const categoryTotalsGel = new Map<string, number>();
  const reviewRows: OldClassificationReviewRow[] = [];
  const addCategory = (field: string, amountGel: number) => {
    categoryTotalsGel.set(field, (categoryTotalsGel.get(field) ?? 0) + amountGel);
  };

  const carveByGroup = new Map<number, CarveOut[]>();
  for (const carve of carveOuts) {
    const list = carveByGroup.get(carve.group) ?? [];
    list.push(carve);
    carveByGroup.set(carve.group, list);
  }

  let grandTotalGel = 0;

  for (let group = 1; group <= 14; group += 1) {
    const groupTotal = rows.get(`${group}.0.0`);
    if (groupTotal === undefined) continue;
    grandTotalGel += groupTotal;

    const groupCarves = carveByGroup.get(group) ?? [];
    let remainder = groupTotal;

    for (const carve of groupCarves) {
      const amount = rows.get(carve.codeKey);
      if (amount === undefined || amount === 0) continue;
      addCategory(carve.toField, amount);
      remainder -= amount;
      reviewRows.push({
        year: input.year,
        sourceId: input.sourceId,
        code: carve.codeKey,
        labelKa: carve.labelKa,
        actualGel: Math.round(amount),
        publicSpendingFieldId: carve.toField,
        mappingReason: carve.reason,
      });
    }

    const dominantField = dominantFieldByGroup[group];
    addCategory(dominantField, remainder);
    reviewRows.push({
      year: input.year,
      sourceId: input.sourceId,
      code: `${group}.0.0`,
      labelKa: groupLabelKa[group],
      actualGel: Math.round(remainder),
      publicSpendingFieldId: dominantField,
      mappingReason:
        groupCarves.length > 0
          ? "old-classification group remainder after carve-outs mapped to its dominant public category"
          : "old-classification group mapped to its dominant public category",
    });
  }

  const roundedTotals = new Map<string, number>();
  for (const [field, amount] of categoryTotalsGel) roundedTotals.set(field, Math.round(amount));

  return {
    categoryTotalsGel: roundedTotals,
    reviewRows,
    grandTotalGel: Math.round(grandTotalGel),
    officialTotalGel: input.officialTotalGel,
    differenceGel: Math.abs(Math.round(grandTotalGel) - input.officialTotalGel),
  };
}

export function assertOldClassificationReconciled(result: OldClassificationResult): void {
  if (result.differenceGel > reconciliationToleranceGel) {
    throw new Error(
      `Old-classification reconciliation failed: grand ${result.grandTotalGel} vs official ${result.officialTotalGel} (diff ${result.differenceGel})`,
    );
  }
}

function csvEscape(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function oldClassificationReviewRowsToCsv(rows: OldClassificationReviewRow[]): string {
  const headers = ["year", "source_id", "code", "label_ka", "actual_gel", "public_spending_field_id", "mapping_reason"];
  return `﻿${[
    headers.join(","),
    ...rows.map((row) =>
      [row.year, row.sourceId, row.code, row.labelKa, row.actualGel, row.publicSpendingFieldId, row.mappingReason]
        .map(csvEscape)
        .join(","),
    ),
  ].join("\n")}`;
}
