const fs = require("fs");
for (const [p, edits] of [
  ["apps/web/lib/data/realRevenue/types.ts", [["export type RealRevenuePdfSource = {\n  year: number;\n  sourceId: string;\n  pdfPath: string;\n};", "export type RealRevenuePdfSource = {\n  year: number;\n  sourceId: string;\n  pdfPath: string;\n  textPath?: string;\n};"]]],
  ["apps/web/scripts/generate-real-revenue-facts.ts", [["totalOnlyRows: TOTAL_ONLY_BUDGET_FACT_REPORT.rows.filter((row) => row.side === \"revenue\"),", "totalOnlyRows: TOTAL_ONLY_BUDGET_FACT_REPORT.rows.filter(\n      (row) => row.side === \"revenue\" && !REVENUE_DETAILED_YEARS.includes(row.year),\n    ),"]]],
]) {
  let s = fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
  for (const [from, to] of edits) {
    if (!s.includes(from)) throw new Error(`Pattern not found in ${p}: ${from}`);
    s = s.replace(from, to);
  }
  fs.writeFileSync(p, s, "utf8");
}
