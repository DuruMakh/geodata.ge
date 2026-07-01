import type { OfficialRevenueRow, RevenueMatrixSection } from "./types";

type ParseTreasuryPdfInput = {
  year: number;
  sourceId: string;
  pdfPath: string;
  text: string;
};

type CodeMatch = {
  code: string;
  index: number;
  contentStart: number;
};

type ParsedAmount = {
  value: string;
  index: number;
};

const rowCodePattern = /(?:^|\s)(\d+(?:\.\d+)*)(?=\s)/g;
const amountPattern = /-?(?:\d{1,3}(?:,\d{3})+|\d{1,3}(?: \d{3})+|\d+)\.\d{2}/g;

function normalizeText(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function parseAmountGel(value: string): number {
  return Number(value.replace(/,/g, "").replace(/\s/g, ""));
}

function isLikelyBudgetCode(code: string): boolean {
  if (code.includes(".")) return /^\d{1,2}(?:\.\d+)+$/.test(code);
  if (["31", "32", "33", "41"].includes(code)) return true;
  if (/^[1-5]\d{1,5}$/.test(code)) return true;
  return ["0", "1", "2", "3", "4", "5"].includes(code);
}

function sectionForOldCode(code: string): RevenueMatrixSection {
  if (code.startsWith("01") || code.startsWith("02") || code.startsWith("04")) return "revenues";
  if (code.startsWith("03")) return "non_financial_assets";
  if (code.startsWith("05")) return "liabilities";
  return "other";
}

function isOldFixedWidthCode(code: string): boolean {
  return /^0[1-5]\d{6}$/.test(code) || /^\d{12}$/.test(code);
}

function sectionForCode(code: string): RevenueMatrixSection {
  if (code === "31" || code.startsWith("31.")) return "non_financial_assets";
  if (code === "32" || code.startsWith("32.")) return "financial_assets";
  if (code === "33" || code.startsWith("33.")) return "liabilities";
  if (code === "41" || code.startsWith("41.")) return "opening_balance";
  if (code === "1" || code.startsWith("1.") || /^1\d+$/.test(code)) return "revenues";
  if (code === "2" || code.startsWith("2.")) return "expenditures";
  if (code === "3" || code.startsWith("3.")) return "non_financial_assets";
  if (code === "5" || code.startsWith("5.")) return "liabilities";
  return "other";
}

function findCodeMatches(text: string): CodeMatch[] {
  const matches: CodeMatch[] = [];
  let match: RegExpExecArray | null;

  rowCodePattern.lastIndex = 0;
  while ((match = rowCodePattern.exec(text)) !== null) {
    const code = match[1];
    if (!isLikelyBudgetCode(code)) continue;
    const contentStart = match.index + match[0].length;
    const nextContentCharacter = text.slice(contentStart).trimStart()[0] ?? "";
    if (/[\d.,-]/.test(nextContentCharacter)) continue;

    matches.push({
      code,
      index: match.index + match[0].indexOf(code),
      contentStart,
    });
  }

  return matches;
}


function parseOldCodeRows(input: ParseTreasuryPdfInput, text: string): OfficialRevenueRow[] {
  const codeMatches = Array.from(text.matchAll(/(?<!\d)(?:0[1-5]\d{6}|\d{12})(?!\d)/g)).filter((match) => isOldFixedWidthCode(match[0]));
  const rows: OfficialRevenueRow[] = [];

  for (const [index, codeMatch] of codeMatches.entries()) {
    const code = codeMatch[0];
    const contentStart = (codeMatch.index ?? 0) + code.length;
    const next = codeMatches[index + 1];
    const segment = text.slice(contentStart, next?.index).trim();
    const amounts: ParsedAmount[] = Array.from(segment.matchAll(amountPattern)).map((match) => ({
      value: match[0],
      index: match.index ?? 0,
    }));

    if (amounts.length < 3) continue;

    const stateBudgetActualGel = parseAmountGel(amounts[0]?.value ?? "0");
    const territorialBudgetActualGel = parseAmountGel(amounts[1]?.value ?? "0");
    const consolidatedActualGel = parseAmountGel(amounts[2]?.value ?? "0");
    const labelKa = normalizeText(segment.slice(0, amounts[0]?.index));
    if (!labelKa) continue;

    rows.push({
      year: input.year,
      sourceId: input.sourceId,
      workbookPath: input.pdfPath,
      sheetName: "form #1",
      rowNumber: rows.length + 1,
      sourceCode: code,
      labelKa,
      section: sectionForOldCode(code),
      approvedPlanThousandGel: null,
      revisedPlanThousandGel: null,
      actualThousandGel: stateBudgetActualGel / 1000,
      executionPercent: null,
      stateBudgetActualGel,
      territorialBudgetActualGel,
      consolidatedActualGel,
    });
  }

  return rows;
}

export function parseTreasuryPdfRows(input: ParseTreasuryPdfInput): OfficialRevenueRow[] {
  const text = normalizeText(input.text);
  const oldCodeRows = parseOldCodeRows(input, text);
  if (oldCodeRows.length > 0) return oldCodeRows;
  const matches = findCodeMatches(text);
  const rows: OfficialRevenueRow[] = [];

  for (const [index, match] of matches.entries()) {
    const next = matches[index + 1];
    const segment = text.slice(match.contentStart, next?.index).trim();
    const amounts = Array.from(segment.matchAll(amountPattern));
    if (amounts.length < 3) continue;

    const stateBudgetActualGel = parseAmountGel(amounts.at(-3)?.[0] ?? "0");
    const territorialBudgetActualGel = parseAmountGel(amounts.at(-2)?.[0] ?? "0");
    const consolidatedActualGel = parseAmountGel(amounts.at(-1)?.[0] ?? "0");
    const firstAmount = amounts[0];
    const labelKa = normalizeText(segment.slice(0, firstAmount.index).replace(/\s-\s*$/, ""));
    if (!labelKa) continue;
    if (
      labelKa.startsWith("of ")
      || labelKa.startsWith("--")
      || labelKa.includes(" of ")
      || labelKa.includes("დან --")
      || labelKa.includes("გვერდი")
    ) continue;

    rows.push({
      year: input.year,
      sourceId: input.sourceId,
      workbookPath: input.pdfPath,
      sheetName: "form #1",
      rowNumber: rows.length + 1,
      sourceCode: match.code,
      labelKa,
      section: sectionForCode(match.code),
      approvedPlanThousandGel: null,
      revisedPlanThousandGel: null,
      actualThousandGel: stateBudgetActualGel / 1000,
      executionPercent: null,
      stateBudgetActualGel,
      territorialBudgetActualGel,
      consolidatedActualGel,
    });
  }

  return rows;
}
