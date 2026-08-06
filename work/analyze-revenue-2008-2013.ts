import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import { parseTreasuryPdfRows } from "../apps/web/lib/data/realRevenue/parseTreasuryPdfRows";
import { generateRevenueFacts } from "../apps/web/lib/data/realRevenue/generateFacts";

const years = [2008, 2009, 2010, 2011, 2012, 2013];
const requiredOldCodes = [
  "010000000000",
  "010100000000",
  "010200000000",
  "010300000000",
  "010400000000",
  "010500000000",
  "010600000000",
  "013000000000",
  "020000000000",
  "030000000000",
  "040000000000",
  "050000000000",
];

async function pdfText(pdfFile: string) {
  const data = await readFile(pdfFile);
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function main() {
for (const year of years) {
  const pdfPath = `docs/Raw Data/Revenue/${year}-jan-dec-consolidated-revenue.pdf`;
  const text = await pdfText(path.resolve(pdfPath));
  const rows = parseTreasuryPdfRows({
    year,
    sourceId: `source.mof_${year}_revenue_form1_pdf`,
    pdfPath,
    text,
  });
  const codes = new Set(rows.map((row) => row.sourceCode).filter(Boolean));
  const oldRows = rows.filter((row) => /^\d{12}$/.test(row.sourceCode ?? ""));
  const missing = requiredOldCodes.filter((code) => !codes.has(code));
  let generated = "ok";
  try {
    generateRevenueFacts(rows);
  } catch (error) {
    generated = error instanceof Error ? error.message : String(error);
  }
  const total = rows.find((row) => row.sourceCode === "010000000000")?.consolidatedActualGel ?? null;
  const receiptTotal = ["010000000000", "020000000000", "030000000000", "040000000000", "050000000000"]
    .map((code) => rows.find((row) => row.sourceCode === code)?.consolidatedActualGel ?? 0)
    .reduce((sum, value) => sum + value, 0);
  console.log(JSON.stringify({
    year,
    parsedRows: rows.length,
    oldRows: oldRows.length,
    sampleCodes: rows.slice(0, 12).map((row) => row.sourceCode),
    missingRequiredOldCodes: missing,
    revenueTotalGel: total,
    receiptTotalGel: receiptTotal || null,
    generated,
  }));
}

}

main().catch((error) => { console.error(error); process.exit(1); });


