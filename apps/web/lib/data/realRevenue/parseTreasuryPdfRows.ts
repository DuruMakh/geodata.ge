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

const rowCodePattern = /(?:^|\s)(\d+(?:\.\d+)*)(?=\s)/g;
const amountPattern = /-?(?:\d{1,3}(?:,\d{3})+|\d{1,3}(?: \d{3})+|\d+)\.\d{2}/g;

function normalizeText(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function parseAmountGel(value: string): number {
  return Number(value.replace(/,/g, "").replace(/\s/g, ""));
}

function isLikelyBudgetCode(code: string): boolean {
  if (code.includes(".")) return true;
  return ["0", "1", "2", "3", "4", "5"].includes(code);
}

function sectionForCode(code: string): RevenueMatrixSection {
  if (code === "1" || code.startsWith("1.")) return "revenues";
  if (code === "2" || code.startsWith("2.")) return "expenditures";
  if (code === "3" || code.startsWith("3.")) return "non_financial_assets";
  if (code === "4" || code.startsWith("4.")) return "financial_assets";
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

export function parseTreasuryPdfRows(input: ParseTreasuryPdfInput): OfficialRevenueRow[] {
  const text = normalizeText(input.text);
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
