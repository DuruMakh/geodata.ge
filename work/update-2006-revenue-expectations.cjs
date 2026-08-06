const fs = require("fs");
function edit(p, replacements) {
  let s = fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
  for (const [from, to] of replacements) {
    if (!s.includes(from)) throw new Error(`Pattern not found in ${p}: ${from}`);
    s = s.replace(from, to);
  }
  fs.writeFileSync(p, s, "utf8");
}
edit("apps/web/scripts/compose-budget-facts.ts", [
  ["import { EXPENDITURE_DETAILED_YEARS, EXPENDITURE_YEARS, REVENUE_YEARS } from \"../lib/data/coverage\";", "import { EXPENDITURE_DETAILED_YEARS, EXPENDITURE_YEARS, REVENUE_TOTAL_ONLY_YEARS, REVENUE_YEARS } from \"../lib/data/coverage\";"],
  ["totalOnlyRows: TOTAL_ONLY_BUDGET_FACT_REPORT.rows,", "totalOnlyRows: TOTAL_ONLY_BUDGET_FACT_REPORT.rows.filter((row) => row.side !== \"revenue\" || REVENUE_TOTAL_ONLY_YEARS.includes(row.year)),"],
]);
edit("apps/web/tests/explorer/integration.test.ts", [
  ["const expectedReceiptsByYear = new Map([\n      [2016, 11595009761],", "const expectedReceiptsByYear = new Map([\n      [2006, 4537916326],\n      [2016, 11595009761],"],
  ["const expectedNetRevenueByYear = new Map([\n      [2016, 9675743059],", "const expectedNetRevenueByYear = new Map([\n      [2006, 3802956630],\n      [2016, 9675743059],"],
  ["const totalOnlyRevenueByYear = new Map([\n      [2005, 3289223826],\n      [2006, 4537916325],\n      [2007, 6356421170],\n    ]);", "const totalOnlyRevenueByYear = new Map([\n      [2005, 3289223826],\n      [2007, 6356421170],\n    ]);"],
]);
