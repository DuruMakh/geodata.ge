import type { OfficialExpenditureRow } from "../realExpenditure/types";
import type { ExpenditurePdfPageText } from "./phase1Pilot";
import { financialAssetsGrowthLabelKa, liabilitiesDecreaseLabelKa } from "./final2025Data";

/**
 * Parser for the 2008-2011 mof.ge annual budget-execution reports ("12 თვის
 * მიმოხილვა" / annual report PDFs). These predate the 2012+ programmatic
 * Chapter VI tables: payments are reported by organizational classification
 * (Tavi V, org codes "NN NN[ NN...]"), the 2008-2010 files embed a legacy
 * ASCII-transliteration Georgian font, and amounts are printed in thousand
 * GEL with one decimal in two mixed styles ("1,600,699.3" and "1 600 699,3").
 *
 * The output mirrors the workbook-row shape used by the 2012+ supplement
 * pipeline: a "00 00" total row carrying the official annual payments total,
 * followed, per organizational block that carries them, by a coded org row
 * and label-only "ფინანსური აქტივების ზრდა" / "ვალდებულებების კლება" rows.
 * Only the deepest block that prints a given flow keeps it, so nested
 * repetition of ministry-level aggregates never double-counts.
 */

export type LegacyAnnualReportDialect = "translit" | "unicode";

export type LegacyAnnualReportSource = {
  year: number;
  sourceId: string;
  workbookPath: string;
  dialect: LegacyAnnualReportDialect;
  /** 1-based inclusive PDF page range of the payments-by-organization chapter. */
  orgChapterPageRange: readonly [number, number];
  /**
   * Official summary figures (thousand GEL) from the report's own balance
   * table. The parser fails hard when extracted per-org rows do not add up
   * to these published values.
   */
  officialTotals: {
    paymentsTotalThousandGel: number;
    financialAssetsGrowthThousandGel: number;
    liabilitiesDecreaseThousandGel: number;
  };
};

const reconciliationToleranceThousandGel = 0.25;

// Amount tokens in the two legacy print styles; percent values are rejected
// by the caller via look-ahead.
const legacyAmountToken = /-?(?:\d{1,3}(?:,\d{3})*\.\d+|\d{1,3}(?: \d{3})*,\d+)(?=$|[^\d%,.])/g;

// Org header or wrapped-code fragment: optional stray "a" column marker, then
// one or more two-digit groups. A line is a NEW block header only when it has
// two or more groups and either opens a ministry root ("NN 00") or starts
// with the current ministry id; any other code line is a continuation of a
// code that wrapped across lines and extends the last full header.
const orgHeaderPattern = /^(?:a\s+)?(\d{2}(?:\s+\d{2})*)(?:\s+(\D.*))?$/;

// The organizational table ends at the "SUL ..." grand-total block (2009,
// 2010) or the per-code explanations section (2011).
const chapterStopPatterns = [/^(?:SUL|sul|სულ)\s/, /^(?:ganmartebebi|განმარტებები)/];

const columnHeaderPatterns = [
  /^\d{1,3}$/, // page number
  /^(?:ორგ\.?\s*კოდი|org\.?\s*kodi)/,
  /^(?:დასახელება|dasaxeleba|d\s*a\s*s\s*a\s*x\s*e\s*l\s*e\s*b\s*a)/,
  /^\d{4}\s*(?:წლის|wlis)/,
  /^(?:დამტკიცებული|დაზუსტებული|damtkicebuli|dazustebuli)/,
  /^(?:გეგმა|gegma)$/,
  /^(?:შესრულება|Sesruleba)$/,
  /^(?:საკასო|sakaso)/,
  /^(?:ათას ლარებში|aTas larebSi)/,
];

const translitEconRowPattern = {
  fin: /^(?:a\s+)?(?:\d{1,2}\s+)?finansuri aqtivebis zrda(?=\s|$)/,
  liab: /^(?:a\s+)?(?:\d{1,2}\s+)?valdebulebebis kleba(?=\s|$)/,
} as const;

const unicodeEconRowPattern = {
  fin: /^(?:a\s+)?(?:\d{1,2}\s+)?ფინანსური აქტივების ზრდა(?=\s|$|\d)/,
  liab: /^(?:a\s+)?(?:\d{1,2}\s+)?ვალდებულებების კლება(?=\s|$|\d)/,
} as const;

const otherEconLabelPattern =
  /^(?:a\s+)?(?:\d{1,2}\s+)?(?:xarjebi|Sromis|saqoneli|procenti|subsidiebi|grantebi|socialuri|sxva xarjebi|arafinansuri|ხარჯები|შრომის|საქონელი|პროცენტი|სუბსიდიები|გრანტები|სოციალური|სხვა ხარჯები|არაფინანსური)/;

/**
 * Standard LitNusx/AcadNusx ASCII-to-Georgian letter mapping used by the
 * legacy fonts in the 2008-2010 report PDFs.
 */
const legacyLetterMap = new Map<string, string>([
  ["a", "ა"], ["b", "ბ"], ["g", "გ"], ["d", "დ"], ["e", "ე"], ["v", "ვ"],
  ["z", "ზ"], ["T", "თ"], ["i", "ი"], ["k", "კ"], ["l", "ლ"], ["m", "მ"],
  ["n", "ნ"], ["o", "ო"], ["p", "პ"], ["J", "ჟ"], ["r", "რ"], ["s", "ს"],
  ["t", "ტ"], ["u", "უ"], ["f", "ფ"], ["q", "ქ"], ["R", "ღ"], ["y", "ყ"],
  ["S", "შ"], ["C", "ჩ"], ["c", "ც"], ["Z", "ძ"], ["w", "წ"], ["W", "ჭ"],
  ["x", "ხ"], ["j", "ჯ"], ["h", "ჰ"],
]);

export function transliterateLegacyKa(text: string): string {
  let out = "";
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (/[A-Z]/.test(char)) {
      const previous = text[index - 1] ?? "";
      const next = text[index + 1] ?? "";
      // Latin acronyms (WB, KFW, GTZ, EBRD, IFAD...) keep their letters; the
      // legacy scheme's Georgian capitals (T, R, S, C, Z, W, J) only ever
      // appear singly inside otherwise-lowercase words.
      if (/[A-Z]/.test(previous) || /[A-Z]/.test(next)) {
        out += char;
        continue;
      }
    }
    out += legacyLetterMap.get(char) ?? char;
  }
  return out;
}

function parseLegacyAmounts(line: string): number[] {
  const out: number[] = [];
  for (const match of line.matchAll(legacyAmountToken)) {
    const raw = match[0];
    const after = line.slice((match.index ?? 0) + raw.length).trimStart();
    if (after.startsWith("%")) continue;
    const value =
      raw.includes(",") && raw.includes(".")
        ? Number(raw.replace(/,/g, ""))
        : raw.includes(",")
          ? Number(raw.replace(/ /g, "").replace(",", "."))
          : Number(raw.replace(/ /g, ""));
    if (Number.isFinite(value)) out.push(value);
  }
  return out;
}

function normalizeLine(line: string): string {
  return line.replace(/ /g, " ").replace(/\t/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Hierarchy key: "23 00" (ministry root) -> ["23"], "23 01" -> ["23","01"],
 * "23 01 05" -> ["23","01","05"], grand total "00 00" -> [].
 */
function orgCodeSegments(code: string): string[] {
  const groups = code.split(" ");
  if (groups.every((group) => group === "00")) return [];
  if (groups.length === 2 && groups[1] === "00") return [groups[0]];
  return groups;
}

function isStrictAncestor(ancestor: string[], descendant: string[]): boolean {
  if (ancestor.length >= descendant.length) return false;
  return ancestor.every((segment, index) => descendant[index] === segment);
}

type OrgBlock = {
  code: string;
  segments: string[];
  labelParts: string[];
  amounts: number[];
  page: number;
};

type CapturedFlow = {
  kind: "fin" | "liab";
  org: OrgBlock;
  actualThousandGel: number;
  order: number;
};

export function parseLegacyAnnualReportRows(
  input: LegacyAnnualReportSource & { pages: ExpenditurePdfPageText[] },
): OfficialExpenditureRow[] {
  const econPatterns = input.dialect === "translit" ? translitEconRowPattern : unicodeEconRowPattern;
  const [pageStart, pageEnd] = input.orgChapterPageRange;

  const flows: CapturedFlow[] = [];
  const dedupe = new Set<string>();
  const ministryLabels = new Map<string, string>();
  let currentOrg: OrgBlock | null = null;
  let pendingFlow: { kind: "fin" | "liab"; amounts: number[] } | null = null;
  let currentMinistryId: string | null = null;
  let lastFullHeaderCode: string | null = null;
  let stopped = false;
  let order = 0;

  const recordFlow = (kind: "fin" | "liab", amounts: number[]) => {
    if (!currentOrg || currentOrg.segments.length === 0) return; // grand block: covered by descendants
    const actual = amounts[2];
    if (actual === undefined) return;
    const key = `${currentOrg.code}|${kind}|${amounts.slice(0, 3).join(",")}`;
    if (dedupe.has(key)) return; // page-break table re-prints
    dedupe.add(key);
    flows.push({ kind, org: currentOrg, actualThousandGel: actual, order: (order += 1) });
  };

  for (const page of input.pages) {
    if (stopped) break;
    if (page.pageNumber < pageStart || page.pageNumber > pageEnd) continue;
    const lines = page.text
      .split(/\r?\n/)
      .map(normalizeLine)
      .filter(Boolean);

    for (const line of lines) {
      if (chapterStopPatterns.some((pattern) => pattern.test(line))) {
        stopped = true;
        break;
      }
      if (columnHeaderPatterns.some((pattern) => pattern.test(line))) continue;

      if (pendingFlow) {
        const amounts = parseLegacyAmounts(line);
        pendingFlow.amounts.push(...amounts);
        if (pendingFlow.amounts.length >= 3) {
          recordFlow(pendingFlow.kind, pendingFlow.amounts);
          pendingFlow = null;
          continue;
        }
        if (amounts.length === 0) pendingFlow = null;
        else continue;
      }

      const isFin = econPatterns.fin.test(line);
      const isLiab = econPatterns.liab.test(line);
      if (isFin || isLiab) {
        const kind = isFin ? "fin" : "liab";
        const amounts = parseLegacyAmounts(line);
        if (amounts.length >= 3) recordFlow(kind, amounts);
        else pendingFlow = { kind, amounts };
        continue;
      }

      const orgMatch = line.match(orgHeaderPattern);
      if (orgMatch && !otherEconLabelPattern.test(line)) {
        const groups = orgMatch[1].replace(/\s+/g, " ").split(" ");
        const isMinistryRoot = groups.length === 2 && groups[1] === "00";
        const isFullHeader = groups.length >= 2 && (isMinistryRoot || groups[0] === currentMinistryId);
        let code: string;
        if (isFullHeader) {
          code = groups.join(" ");
          if (isMinistryRoot) currentMinistryId = groups[0];
          lastFullHeaderCode = code;
        } else if (lastFullHeaderCode) {
          // a code that wrapped across lines: its remaining groups extend the
          // last full header (e.g. "25 04 01" + "02 08 ...")
          code = `${lastFullHeaderCode} ${groups.join(" ")}`;
        } else {
          continue;
        }
        const remainder = normalizeLine((orgMatch[2] ?? "").toString());
        const block: OrgBlock = {
          code,
          segments: orgCodeSegments(code),
          labelParts: [],
          amounts: [],
          page: page.pageNumber,
        };
        if (remainder) {
          block.labelParts.push(remainder.replace(legacyAmountToken, "").trim());
          block.amounts.push(...parseLegacyAmounts(remainder));
        }
        currentOrg = block;
        continue;
      }

      if (currentOrg && currentOrg.amounts.length < 3) {
        // wrapped org label and/or its trailing amount cells
        const amounts = parseLegacyAmounts(line);
        const labelPart = line.replace(legacyAmountToken, "").trim();
        if (labelPart) currentOrg.labelParts.push(labelPart);
        currentOrg.amounts.push(...amounts);
        if (currentOrg.amounts.length >= 3 && currentOrg.segments.length === 1) {
          ministryLabels.set(currentOrg.segments[0], currentOrg.labelParts.join(" "));
        }
      }
    }
  }

  // Deepest-carrier rule: a block's flow row is kept only when no captured
  // descendant block carries the same kind (parents print sums of children).
  let kept = flows.filter(
    (flow) =>
      !flows.some(
        (other) =>
          other !== flow && other.kind === flow.kind && isStrictAncestor(flow.org.segments, other.org.segments),
      ),
  );

  // Same-code runs: donor-project component rows repeat their unit's org code,
  // so the unit aggregate and its components share one code. Drop the leading
  // aggregate when the following same-code rows sum to it.
  for (const kind of ["fin", "liab"] as const) {
    const sequence = kept.filter((flow) => flow.kind === kind).sort((a, b) => a.order - b.order);
    const dropped = new Set<CapturedFlow>();
    let index = 0;
    while (index < sequence.length) {
      let runEnd = index + 1;
      while (runEnd < sequence.length && sequence[runEnd].org.code === sequence[index].org.code) runEnd += 1;
      if (runEnd - index > 1) {
        const componentSum = sequence
          .slice(index + 1, runEnd)
          .reduce((total, flow) => total + flow.actualThousandGel, 0);
        if (Math.abs(sequence[index].actualThousandGel - componentSum) <= reconciliationToleranceThousandGel) {
          dropped.add(sequence[index]);
        }
      }
      index = runEnd;
    }
    if (dropped.size > 0) kept = kept.filter((flow) => !dropped.has(flow));
  }

  for (const [kind, expected] of [
    ["fin", input.officialTotals.financialAssetsGrowthThousandGel],
    ["liab", input.officialTotals.liabilitiesDecreaseThousandGel],
  ] as const) {
    const sum = kept.filter((flow) => flow.kind === kind).reduce((total, flow) => total + flow.actualThousandGel, 0);
    if (Math.abs(sum - expected) > reconciliationToleranceThousandGel) {
      throw new Error(
        `Legacy annual report ${input.year}: extracted ${kind} rows sum to ${sum.toFixed(1)} thousand GEL, expected official ${expected.toFixed(1)}`,
      );
    }
  }

  const rows: OfficialExpenditureRow[] = [];
  const baseRow = {
    year: input.year,
    sourceId: input.sourceId,
    workbookPath: input.workbookPath,
    sheetName: "legacy-annual-report",
    approvedPlanThousandGel: null,
    revisedPlanThousandGel: null,
    executionPercent: null,
  } as const;

  rows.push({
    ...baseRow,
    rowNumber: 1,
    code: "00 00",
    parentCode: null,
    depth: 0,
    institutionCode: null,
    institutionLabelKa: null,
    programCode: null,
    programLabelKa: null,
    subprogramCode: null,
    subprogramLabelKa: null,
    isTotal: true,
    isCodedRow: true,
    isLeafCode: false,
    labelKa: "ჯამური გადასახდელები",
    actualThousandGel: input.officialTotals.paymentsTotalThousandGel,
  });

  const toKa = (text: string): string => (input.dialect === "translit" ? transliterateLegacyKa(text) : text);
  let lastEmittedOrgCode: string | null = null;

  for (const flow of kept.sort((a, b) => a.order - b.order)) {
    if (flow.org.code !== lastEmittedOrgCode) {
      const ministryLabel = ministryLabels.get(flow.org.segments[0]);
      rows.push({
        ...baseRow,
        rowNumber: rows.length + 1,
        code: flow.org.code,
        parentCode:
          flow.org.segments.length > 1 ? flow.org.segments.slice(0, -1).join(" ") : flow.org.segments.length === 1 ? null : null,
        depth: flow.org.segments.length,
        institutionCode: `${flow.org.segments[0]} 00`,
        institutionLabelKa: ministryLabel ? toKa(ministryLabel) : null,
        programCode: null,
        programLabelKa: null,
        subprogramCode: null,
        subprogramLabelKa: null,
        isTotal: false,
        isCodedRow: true,
        isLeafCode: true,
        labelKa: toKa(flow.org.labelParts.join(" ")),
        actualThousandGel: flow.org.amounts[2] ?? 0,
      });
      lastEmittedOrgCode = flow.org.code;
    }

    rows.push({
      ...baseRow,
      rowNumber: rows.length + 1,
      code: null,
      parentCode: null,
      depth: null,
      institutionCode: null,
      institutionLabelKa: null,
      programCode: null,
      programLabelKa: null,
      subprogramCode: null,
      subprogramLabelKa: null,
      isTotal: false,
      isCodedRow: false,
      isLeafCode: false,
      labelKa: flow.kind === "fin" ? financialAssetsGrowthLabelKa : liabilitiesDecreaseLabelKa,
      actualThousandGel: flow.actualThousandGel,
    });
  }

  return rows;
}

export type AggregateSupplementItem = {
  code: string;
  labelKa: string;
  kind: "fin" | "liab";
  amountThousandGel: number;
};

/**
 * The 2008 report prints no per-organization financial-assets or liabilities
 * rows; its Tavi I / financial-assets chapter itemizes the flows only at
 * whole-budget level. Those published aggregates are configured explicitly
 * (documented in the methodology with source pages) and emitted in the same
 * workbook-row shape as the parsed years.
 */
export function buildAggregateSupplementWorkbookRows(input: {
  year: number;
  sourceId: string;
  workbookPath: string;
  paymentsTotalThousandGel: number;
  items: readonly AggregateSupplementItem[];
}): OfficialExpenditureRow[] {
  const baseRow = {
    year: input.year,
    sourceId: input.sourceId,
    workbookPath: input.workbookPath,
    sheetName: "legacy-annual-report-aggregates",
    approvedPlanThousandGel: null,
    revisedPlanThousandGel: null,
    executionPercent: null,
  } as const;

  const rows: OfficialExpenditureRow[] = [
    {
      ...baseRow,
      rowNumber: 1,
      code: "00 00",
      parentCode: null,
      depth: 0,
      institutionCode: null,
      institutionLabelKa: null,
      programCode: null,
      programLabelKa: null,
      subprogramCode: null,
      subprogramLabelKa: null,
      isTotal: true,
      isCodedRow: true,
      isLeafCode: false,
      labelKa: "ჯამური გადასახდელები",
      actualThousandGel: input.paymentsTotalThousandGel,
    },
  ];

  for (const item of input.items) {
    rows.push({
      ...baseRow,
      rowNumber: rows.length + 1,
      code: item.code,
      parentCode: null,
      depth: 1,
      institutionCode: null,
      institutionLabelKa: null,
      programCode: null,
      programLabelKa: null,
      subprogramCode: null,
      subprogramLabelKa: null,
      isTotal: false,
      isCodedRow: true,
      isLeafCode: true,
      labelKa: item.labelKa,
      actualThousandGel: item.amountThousandGel,
    });
    rows.push({
      ...baseRow,
      rowNumber: rows.length + 1,
      code: null,
      parentCode: null,
      depth: null,
      institutionCode: null,
      institutionLabelKa: null,
      programCode: null,
      programLabelKa: null,
      subprogramCode: null,
      subprogramLabelKa: null,
      isTotal: false,
      isCodedRow: false,
      isLeafCode: false,
      labelKa: item.kind === "fin" ? financialAssetsGrowthLabelKa : liabilitiesDecreaseLabelKa,
      actualThousandGel: item.amountThousandGel,
    });
  }

  return rows;
}
