import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { contextFor } from "../parsing/hierarchyContext";
import { codeDepth, findLeafCodes, parentCodeFor } from "../realExpenditure/hierarchy";
import type { OfficialExpenditureRow } from "../realExpenditure/types";
import { LEGACY_PROGRAM_JOINS, type LegacyProgramJoin } from "./legacyProgramJoins";

/**
 * Group C ministries-expenditure years extracted from the official mof.ge annual-execution
 * reports. The PDFs are pre-parsed into data/staging/admin-spending-annual-report-rows.csv
 * by scripts/extract-annual-report-pdf.ts; here we read that staging CSV synchronously and
 * build OfficialExpenditureRow[] the same way parseTavi6Rows does for the modern workbooks
 * (leaf detection + institution context), so the existing category/debt classifier and
 * leaf-aggregation reconcile these years exactly like 2013/2017-2025.
 */

const STAGING_PATH = "../../data/staging/admin-spending-annual-report-rows.csv";

type StagingRow = { year: number; code: string; label: string; actual: number };

type YearSource = {
  sourceId: string;
  /** Repo-relative path of the source PDF, recorded on each row for provenance. */
  reportPath: string;
  /**
   * true  — keep coded rows down to maxDepth, so the year gets program-level drill-down (only
   *         for years whose program detail sub-reconciles: 2012, 2015, 2016).
   * false — aggregate at the institution (depth-1) level, because the report's program detail
   *         is incomplete (institution totals != sum of printed programs). Debt still splits:
   *         the state-wide-payments institution keeps its depth-2 children.
   */
  drillDown: boolean;
  /**
   * For drill-down years, the deepest code level whose leaf sum still reconciles. 2016's
   * depth-4 subprograms are complete; 2012's are not (they undercount ~10M), so 2012 caps at
   * depth 3. Undefined = no cap.
   */
  maxDepth?: number;
  /**
   * Some legacy reports have no coded "00 00" grand-total row (the total is uncoded/overflowed).
   * Synthesize the isTotal row with this known payments total so reconciliation still checks the
   * extracted category sum against a real external figure.
   */
  syntheticTotalThousandGel?: number;
  /**
   * Per-code ACTUAL corrections for source "#######" overflow cells (where the printed number
   * exceeded the column width). Each override is reconstructed from the row's economic sub-lines
   * and documented at the call site.
   */
  amountOverrides?: Record<string, number>;
  /**
   * 2006-2009 have no state-wide-payments institution: debt service, intergovernmental transfers
   * and reserves are all booked under the Finance ministry. Split it three ways like 2005:
   * debtThousandGel -> debt_service, financeProperThousandGel (the "ფინანსთა სამინისტრო" own line)
   * -> finance, and the remainder (transfers + reserves + funds) -> other_costs. Figures sourced
   * per year (debt excludes on-lending).
   */
  financeSplit?: { code: string; debtThousandGel: number; financeProperThousandGel: number };
  /**
   * 2006-2009 combine Culture + Monuments + Sport (+ Youth affairs) in one ministry. Peel Sport
   * into admin_spending.sport and Youth into admin_spending.education_science_youth (owner
   * decision: match the 2005 three-way split), with the remainder staying Culture. Figures
   * sourced from each report's department breakdown.
   */
  cultureSportSplit?: { code: string; sportThousandGel: number; youthThousandGel: number };
};

const YEAR_SOURCES: Record<number, YearSource> = {
  2006: {
    sourceId: "source.mof_2006_programmatic_fact_actual",
    reportPath: "docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2006-annual-execution-report.pdf",
    drillDown: false,
    syntheticTotalThousandGel: 3_822_512.6,
    // Finance 25 00 total 744,451.6: finance-proper (25 01) 80,502.2, debt (economic lines interest
    // 100,504.0 + repayment 234,404.6) = 334,908.6 (excludes on-lending 16,415.6); remainder -> other.
    financeSplit: { code: "25 00", debtThousandGel: 334_908.6, financeProperThousandGel: 80_502.2 },
    // Combined Culture+Sport ministry 33 00: sport 33 07 02 = 4,705.3, youth 33 07 03 = 70.0.
    cultureSportSplit: { code: "33 00", sportThousandGel: 4_705.3, youthThousandGel: 70.0 },
  },
  2007: {
    sourceId: "source.mof_2007_programmatic_fact_actual",
    reportPath: "docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2007-annual-execution-report.pdf",
    drillDown: false,
    syntheticTotalThousandGel: 5_237_131.1,
    // Finance 25 00 total 619,736.0: finance-proper (25 01) 107,992.1, debt 25 02 external 170,607.6
    // + 25 04 domestic 78,597.4 = 249,205.0 (no on-lending in either program); remainder (transfers,
    // reserves, the on-lending program 25 03 = 5,719.3, funds) -> other.
    financeSplit: { code: "25 00", debtThousandGel: 249_205.0, financeProperThousandGel: 107_992.1 },
    // Combined Culture+Sport ministry 33 00: sport dept 33 07 02 = 8,682.6, youth 33 07 03 = 70.0.
    cultureSportSplit: { code: "33 00", sportThousandGel: 8_682.6, youthThousandGel: 70.0 },
  },
  2008: {
    sourceId: "source.mof_2008_programmatic_fact_actual",
    reportPath: "docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2008-annual-execution-report.pdf",
    drillDown: false,
    syntheticTotalThousandGel: 6_758_831.8,
    // Finance 25 00: finance-proper (25 01) 107,917.4, debt (25 02 + 25 04) 203,689.1; remainder
    // (transfers 25 05 = 859,442.5, reserves, funds) -> other.
    financeSplit: { code: "25 00", debtThousandGel: 203_689.1, financeProperThousandGel: 107_917.4 },
    // Combined Culture+Sport ministry 33 00: sport 15,125.8, youth 661.4.
    cultureSportSplit: { code: "33 00", sportThousandGel: 15_125.8, youthThousandGel: 661.4 },
  },
  2009: {
    sourceId: "source.mof_2009_programmatic_fact_actual",
    reportPath: "docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2009-annual-execution-report.pdf",
    drillDown: false,
    syntheticTotalThousandGel: 6_754_106.8,
    // Finance 23 00 (2009 Finance code): finance-proper (23 01) 142,157.5, debt (23 02 + 23 04)
    // 318,057.6; remainder (transfers 23 05 = 847,163.9, tax-arrears, funds) -> other.
    financeSplit: { code: "23 00", debtThousandGel: 318_057.6, financeProperThousandGel: 142_157.5 },
    // Combined Culture+Sport ministry 33 00: sport 11,784.0, youth 955.6.
    cultureSportSplit: { code: "33 00", sportThousandGel: 11_784.0, youthThousandGel: 955.6 },
  },
  2010: {
    sourceId: "source.mof_2010_programmatic_fact_actual",
    reportPath: "docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2010-annual-execution-report.pdf",
    drillDown: false,
    // 2010's org table has no coded 00 00 row (its total is an uncoded, overflowed "šul" line);
    // the PDF summary and narrative both give 6,972,343.8, which is also the exact leaf sum.
    syntheticTotalThousandGel: 6_972_343.8,
    // The 35 00 (Labour/Health/Social) total cell printed as "#######" overflow, so the parser
    // latched its "ხარჯები" economic line (1,558,237.0) as the ministry actual. Reconstruct the
    // true total from the ministry's economic sub-lines: ხარჯები 1,558,237.0 + არაფინანსური
    // აქტივების ზრდა 46,457.4 + ვალდებულებების კლება 347.0 = 1,605,041.4. (53 00's identical
    // overflow self-heals: institution-level keeps its depth-2 children, which sum to its total.)
    amountOverrides: { "35 00": 1_605_041.4 },
  },
  2011: {
    sourceId: "source.mof_2011_programmatic_fact_actual",
    reportPath: "docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2011-annual-execution-report.pdf",
    drillDown: false,
  },
  2012: {
    sourceId: "source.mof_2012_programmatic_fact_actual",
    reportPath: "docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2012-annual-execution-report.pdf",
    drillDown: true,
    maxDepth: 3,
  },
  2015: {
    sourceId: "source.mof_2015_programmatic_fact_actual",
    reportPath: "docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2015-annual-execution-tavi-VI-programmatic.pdf",
    // Full program detail like 2016 (owner-verified 2026-07-07): all 23 program-carrying
    // institutions sum to their totals at every depth (121 depth-2 rows; net drift -0.3k),
    // so the year gets the full drill-down. The earlier "printed program detail incomplete"
    // note was wrong — it referred to the 38 small institutions that print no program rows,
    // which simply remain their own aggregation leaves.
    drillDown: true,
  },
  2016: {
    sourceId: "source.mof_2016_programmatic_fact_actual",
    reportPath: "docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2016-annual-execution-tavi-VI-programmatic.pdf",
    drillDown: true,
  },
};

const isDepth1Institution = (code: string) => /^\d{2} 00$/.test(code) && code !== "00 00";
const codeGroupCount = (code: string) => code.trim().split(/\s+/).length;
const institutionPrefix = (code: string) => code.slice(0, 2);

/**
 * Institution-level selection for years without reliable program detail: keep the grand
 * total, every depth-1 institution row, and the depth-2 children of the state-wide-payments
 * institution (so debt service still splits out of it — its children sum to its total). All
 * deeper/other program rows are dropped, so the depth-1 institutions are the aggregation
 * leaves and the category sum reconciles to the grand total.
 */
function selectInstitutionLevel(staging: StagingRow[]): StagingRow[] {
  const stateWidePrefixes = new Set(
    staging
      .filter((row) => isDepth1Institution(row.code))
      .filter((row) => row.label.includes("საერთო") && row.label.includes("მნიშვნელობის გადასახდელები"))
      .map((row) => institutionPrefix(row.code)),
  );

  return staging.filter((row) => {
    if (row.code === "00 00") return true;
    if (isDepth1Institution(row.code)) return true;
    return codeGroupCount(row.code) === 2 && stateWidePrefixes.has(institutionPrefix(row.code));
  });
}

// Synthetic split-row labels chosen so classifyAdminSpendingCategory routes each part to the
// intended category (same labels the 2005 extractor uses in extractOlderMinistryYears).
const DEBT_SPLIT_LABEL =
  "საერთო-სახელმწიფოებრივი მნიშვნელობის გადასახდელები – სახელმწიფო ვალდებულებების მომსახურება და დაფარვა";
const STATE_WIDE_OTHER_LABEL =
  "საერთო-სახელმწიფოებრივი მნიშვნელობის გადასახდელები – ტრანსფერები და სხვა გადასახდელები";
const CULTURE_SPLIT_LABEL = "საქართველოს კულტურის და ძეგლთა დაცვის სამინისტრო";
const SPORT_SPLIT_LABEL = "სპორტის დეპარტამენტი";
const YOUTH_SPLIT_LABEL = "ახალგაზრდობის საქმეთა დეპარტამენტი";

/**
 * Replace a combined depth-1 institution with owner-decided synthetic parts that sum to its
 * total, so the shared classifier routes each part correctly (mirrors the 2005 handling):
 *  - financeSplit: split the Finance ministry into debt / finance-proper / other (2006-2009).
 *  - cultureSportSplit: peel Sport and Youth out of the combined Culture+Sport ministry.
 */
function applyInstitutionSplits(staging: StagingRow[], year: number, source: YearSource): StagingRow[] {
  let rows = staging;

  const replaceInstitution = (code: string, make: (target: StagingRow) => StagingRow[]) => {
    const index = rows.findIndex((row) => row.code === code && isDepth1Institution(row.code));
    if (index < 0) throw new Error(`${year}: split target institution ${code} not found in staged rows.`);
    const parts = make(rows[index]);
    // A negative residual means a hardcoded split figure exceeds the institution total (a bad
    // constant or a shrunk re-extraction). Fail loudly rather than silently reconciling.
    const negative = parts.find((part) => part.actual < -0.05);
    if (negative) {
      throw new Error(
        `${year}: split of institution ${code} produced a negative component (${negative.actual}k, "${negative.label.slice(0, 40)}") — a hardcoded figure exceeds the institution total ${rows[index].actual}k.`,
      );
    }
    rows = [...rows.slice(0, index), ...parts, ...rows.slice(index + 1)];
  };

  if (source.financeSplit) {
    const { code, debtThousandGel, financeProperThousandGel } = source.financeSplit;
    // The 2006-2009 Finance ministry is really a common-payments bucket: only the
    // finance-proper part is the ministry itself; the rest is debt service plus
    // intergovernmental transfers, reserves and funds. Split three ways like 2005.
    replaceInstitution(code, (target) => [
      { year, code, label: target.label, actual: financeProperThousandGel },
      { year, code, label: DEBT_SPLIT_LABEL, actual: debtThousandGel },
      { year, code, label: STATE_WIDE_OTHER_LABEL, actual: target.actual - debtThousandGel - financeProperThousandGel },
    ]);
  }

  if (source.cultureSportSplit) {
    const { code, sportThousandGel, youthThousandGel } = source.cultureSportSplit;
    replaceInstitution(code, (target) => [
      { year, code, label: CULTURE_SPLIT_LABEL, actual: target.actual - sportThousandGel - youthThousandGel },
      { year, code, label: SPORT_SPLIT_LABEL, actual: sportThousandGel },
      ...(youthThousandGel > 0 ? [{ year, code, label: YOUTH_SPLIT_LABEL, actual: youthThousandGel }] : []),
    ]);
  }

  return rows;
}

let stagingCache: Map<number, StagingRow[]> | null = null;

function loadStaging(): Map<number, StagingRow[]> {
  if (stagingCache) return stagingCache;
  const file = path.resolve(process.cwd(), STAGING_PATH);
  const records = parse(readFileSync(file, "utf8"), { columns: true, skip_empty_lines: true }) as Array<
    Record<string, string>
  >;

  const byYear = new Map<number, StagingRow[]>();
  for (const record of records) {
    const year = Number(record.year);
    const actual = Number(record.actual_thousand_gel);
    if (!Number.isFinite(year) || !Number.isFinite(actual)) continue;
    const rows = byYear.get(year) ?? [];
    rows.push({ year, code: record.code, label: record.label, actual });
    byYear.set(year, rows);
  }
  stagingCache = byYear;
  return byYear;
}

function buildYearRows(year: number): OfficialExpenditureRow[] {
  const source = YEAR_SOURCES[year];
  if (!source) throw new Error(`No annual-report source registered for ${year}`);
  const staged = loadStaging().get(year);
  if (!staged || staged.length === 0) {
    throw new Error(
      `No staged annual-report rows for ${year}. Run "npm run data:extract-annual-reports" to regenerate the staging CSV.`,
    );
  }
  const corrected = source.amountOverrides
    ? staged.map((row) => (row.code in source.amountOverrides! ? { ...row, actual: source.amountOverrides![row.code] } : row))
    : staged;

  let staging = source.drillDown
    ? corrected.filter((row) => source.maxDepth === undefined || codeGroupCount(row.code) <= source.maxDepth)
    : selectInstitutionLevel(corrected);

  if (source.financeSplit || source.cultureSportSplit) {
    staging = applyInstitutionSplits(staging, year, source);
  }

  if (source.syntheticTotalThousandGel !== undefined && !staging.some((row) => row.code === "00 00")) {
    staging = [{ year, code: "00 00", label: "სულ ჯამი", actual: source.syntheticTotalThousandGel }, ...staging];
  }

  const preliminary = staging.map((row, index): Omit<OfficialExpenditureRow, "isLeafCode"> => ({
    year,
    sourceId: source.sourceId,
    workbookPath: source.reportPath,
    sheetName: "tavi VI (annual execution report PDF)",
    rowNumber: index + 2,
    code: row.code,
    parentCode: parentCodeFor(row.code),
    depth: codeDepth(row.code),
    institutionCode: null,
    institutionLabelKa: null,
    programCode: null,
    programLabelKa: null,
    subprogramCode: null,
    subprogramLabelKa: null,
    isTotal: row.code === "00 00",
    isCodedRow: true,
    labelKa: row.label,
    approvedPlanThousandGel: null,
    revisedPlanThousandGel: null,
    actualThousandGel: row.actual,
    executionPercent: null,
  }));

  const leafCodes = new Set(
    findLeafCodes(preliminary.map((row) => row.code).filter((code): code is string => Boolean(code))),
  );
  const rowsByCode = new Map(
    preliminary.filter((row) => row.code).map((row) => [row.code as string, { labelKa: row.labelKa }]),
  );

  const aggregationRows = preliminary.map((row) => {
    const context = contextFor(row.code, rowsByCode);
    // A depth-1 institution IS its own institution, so its institution label is its own label.
    // This also keeps split rows (multiple rows sharing one NN 00 code — e.g. the Finance debt
    // vs remainder, or the culture/sport/youth parts) each classified by their OWN label, which
    // the code->label context map (one entry per code) would otherwise collapse to a single label.
    const ownInstitution = row.code && isDepth1Institution(row.code)
      ? { institutionCode: row.code, institutionLabelKa: row.labelKa }
      : {};
    return {
      ...row,
      ...context,
      ...ownInstitution,
      isLeafCode: row.code ? leafCodes.has(row.code) : false,
    };
  });

  // Owner-approved pre-2012 program points (see legacyProgramJoins.ts). Appended AFTER leaf
  // detection and marked isLeafCode=false, so they join the program drill-down (depth-2 rows)
  // without ever touching category aggregation or reconciliation — the institution-level
  // aggregation above stays byte-identical.
  const joins = LEGACY_PROGRAM_JOINS.filter((join) => join.year === year);
  const joinedRows = joins.map((join, index) => buildJoinedProgramRow(join, corrected, source, index));
  return [...aggregationRows, ...joinedRows];
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Build one synthetic depth-2 program row for an owner-approved legacy join: the sum of the
 * join's source rows, carrying the primary source code + source institution for provenance.
 */
function buildJoinedProgramRow(
  join: LegacyProgramJoin,
  corrected: StagingRow[],
  source: YearSource,
  index: number,
): OfficialExpenditureRow {
  const components = join.sourceCodes.map((code, index) => {
    const matches = corrected.filter((candidate) => candidate.code === code);
    if (matches.length === 0) {
      throw new Error(
        `${join.year}: legacy program join source code ${code} (target ${join.targetCode}) not found in staged rows.`,
      );
    }
    // The staging can contain (year, code) echoes from parser artifacts; a join must never
    // silently pick one of several candidates.
    if (matches.length > 1) {
      throw new Error(
        `${join.year}: legacy program join source code ${code} (target ${join.targetCode}) matches ${matches.length} staged rows (${matches.map((row) => row.actual).join(", ")}k) — ambiguous.`,
      );
    }
    const row = matches[0];
    // A modelled split's constants are only valid for the source values they were derived
    // from; pin them so a re-extraction that shifts a source fails loudly.
    const expected = join.componentActualsThousandGel?.[index];
    if (expected !== undefined && Math.abs(row.actual - expected) > 0.05) {
      throw new Error(
        `${join.year}: legacy join source ${code} (target ${join.targetCode}) actual ${row.actual}k differs from the pinned ${expected}k — re-derive the join's split figures.`,
      );
    }
    return row;
  });
  const institutionPrefixes = new Set(components.map((row) => institutionPrefix(row.code)));
  if (institutionPrefixes.size !== 1) {
    throw new Error(`${join.year}: legacy join for ${join.targetCode} mixes institutions (${[...institutionPrefixes].join(", ")}).`);
  }
  const primary = components[0];
  const institutionCode = parentCodeFor(primary.code);
  const institution = institutionCode ? corrected.find((row) => row.code === institutionCode) : undefined;
  if (!institutionCode || !institution) {
    throw new Error(`${join.year}: institution ${institutionCode ?? "?"} for legacy join ${join.targetCode} not found.`);
  }
  const labelKa = join.labelKaOverride ?? primary.label;
  const componentSum = round1(components.reduce((sum, row) => sum + row.actual, 0));
  if (join.amountThousandGelOverride !== undefined && join.amountThousandGelOverride > componentSum + 0.05) {
    throw new Error(
      `${join.year}: legacy join override for ${join.targetCode} (${join.amountThousandGelOverride}k) exceeds its component sum (${componentSum}k).`,
    );
  }

  return {
    year: join.year,
    sourceId: source.sourceId,
    workbookPath: source.reportPath,
    sheetName: "tavi VI (annual execution report PDF)",
    rowNumber: 9000 + index,
    code: primary.code,
    parentCode: institutionCode,
    depth: 2,
    institutionCode,
    institutionLabelKa: institution.label,
    programCode: primary.code,
    programLabelKa: labelKa,
    subprogramCode: null,
    subprogramLabelKa: null,
    isTotal: false,
    isCodedRow: true,
    // Never an aggregation leaf: the institution-level rows above already carry this money.
    isLeafCode: false,
    labelKa,
    approvedPlanThousandGel: null,
    revisedPlanThousandGel: null,
    actualThousandGel: join.amountThousandGelOverride ?? componentSum,
    executionPercent: null,
    legacyProgramJoin: {
      targetCode: join.targetCode,
      targetParentItemId: join.targetParentItemId,
      note: join.note,
    },
  };
}

export const ANNUAL_REPORT_YEAR_EXTRACTORS: Record<number, () => OfficialExpenditureRow[]> = Object.fromEntries(
  Object.keys(YEAR_SOURCES).map((year) => [Number(year), () => buildYearRows(Number(year))]),
);
