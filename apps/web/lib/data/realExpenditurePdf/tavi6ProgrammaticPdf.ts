import { contextFor } from "../parsing/hierarchyContext";
import { codeDepth, findLeafCodes, parentCodeFor } from "../realExpenditure/hierarchy";
import type { OfficialExpenditureRow } from "../realExpenditure/types";
import type { ExpenditurePdfPageText } from "./phase1Pilot";

/**
 * Parser for the annual budget execution report annex "თავი VI — სახელმწიფო
 * ბიუჯეტის გადასახდელები პროგრამული კლასიფიკაციის მიხედვით" published as PDF
 * (mof.ge annual execution reports; used for 2015 and 2016 where no execution
 * workbook exists). Rows carry thousand-GEL amounts in three columns:
 * approved plan, revised plan, actual execution.
 */
export type Tavi6ProgrammaticPdfSource = {
  year: number;
  sourceId: string;
  workbookPath: string;
};

const amountToken = "-?\\d{1,3}(?:,\\d{3})*\\.\\d";
// Rows may end with a footnote marker after the last amount ("... 0.0 0.0 0.0 *").
const rowEndsWithAmountPattern = new RegExp(`${amountToken}\\s*\\*{0,2}\\s*$`);
const trailingAmountsPattern = new RegExp(`((?:${amountToken})(?:\\s+(?:${amountToken}))*)\\s*\\*{0,2}\\s*$`);
const codePrefixPattern = /^(00 00|\d{2} \d{2}(?: \d{2}){0,2})\s+/;

const headerLinePatterns: RegExp[] = [
  /^\d{1,4}$/,
  /^თავი VI$/,
  /^20\d{2} წლის სახელმწიფო ბიუჯეტის გადასახდელები პროგრამული კლასიფიკაციის$/,
  /^მიხედვით$/,
  /^ათასი ლარი$/,
  /^ორგანიზაციული$/,
  /^(ორგანიზაციული )?კოდი (მხარჯავი დაწესებულება|დასახელება)$/,
  /^20\d{2} წლის$/,
  /^(დამტკიცებული|დაზუსტებული|ფაქტიური)$/,
  /^(გეგმა|შესრულება)$/,
  /^მომუშავეთა რიცხოვნობა[\d\s,]*$/,
];

function normalizeLine(value: string): string {
  return value.replace(/ /g, " ").replace(/\t/g, " ").replace(/\s+/g, " ").trim();
}

function isHeaderLine(line: string): boolean {
  return headerLinePatterns.some((pattern) => pattern.test(line));
}

function parseThousandGel(value: string): number {
  return Number(value.replaceAll(",", ""));
}

type RawParsedRow = Omit<
  OfficialExpenditureRow,
  "isLeafCode" | "institutionCode" | "institutionLabelKa" | "programCode" | "programLabelKa" | "subprogramCode" | "subprogramLabelKa"
>;

export function parseTavi6ProgrammaticPdfRows(
  input: Tavi6ProgrammaticPdfSource & { pages: ExpenditurePdfPageText[] },
): OfficialExpenditureRow[] {
  const rawRows: RawParsedRow[] = [];
  let buffer = "";
  let rowNumber = 0;

  for (const page of input.pages) {
    for (const rawLine of page.text.split(/\r?\n/)) {
      const line = normalizeLine(rawLine);
      if (!line || isHeaderLine(line)) continue;

      buffer = buffer ? `${buffer} ${line}` : line;
      if (!rowEndsWithAmountPattern.test(line)) continue;

      const amountsMatch = buffer.match(trailingAmountsPattern);
      if (!amountsMatch) {
        buffer = "";
        continue;
      }

      const amounts = amountsMatch[1].split(/\s+/).map(parseThousandGel).slice(-3);
      const beforeAmounts = buffer.slice(0, buffer.length - amountsMatch[0].length).trim();
      const codeMatch = beforeAmounts.match(codePrefixPattern);
      const code = codeMatch ? codeMatch[1] : null;
      const labelKa = codeMatch ? beforeAmounts.slice(codeMatch[0].length).trim() : beforeAmounts;
      buffer = "";

      if (!labelKa || amounts.length < 2 || amounts.some((amount) => !Number.isFinite(amount))) continue;

      rowNumber += 1;
      const actualThousandGel = amounts[amounts.length - 1] as number;
      rawRows.push({
        year: input.year,
        sourceId: input.sourceId,
        workbookPath: input.workbookPath,
        sheetName: "TAVI VI (PDF)",
        rowNumber,
        code,
        parentCode: code ? parentCodeFor(code) : null,
        depth: code ? codeDepth(code) : null,
        isTotal: code === "00 00",
        isCodedRow: Boolean(code),
        labelKa,
        approvedPlanThousandGel: amounts.length >= 2 ? (amounts[0] as number) : null,
        revisedPlanThousandGel: amounts.length === 3 ? (amounts[1] as number) : null,
        actualThousandGel,
        executionPercent: null,
      });
    }
  }

  const leafCodes = new Set(findLeafCodes(rawRows.map((row) => row.code).filter((code): code is string => Boolean(code))));
  const rowsByCode = new Map(rawRows.filter((row) => row.code).map((row) => [row.code as string, { labelKa: row.labelKa }]));

  return rawRows.map((row) => ({
    ...row,
    ...contextFor(row.code, rowsByCode),
    isLeafCode: row.code ? leafCodes.has(row.code) : false,
  }));
}

export function tavi6ProgrammaticPdfTotalActualGel(rows: OfficialExpenditureRow[]): number | null {
  const totalRow = rows.find((row) => row.isTotal && row.code === "00 00");
  return totalRow ? Math.round(totalRow.actualThousandGel * 1000) : null;
}
