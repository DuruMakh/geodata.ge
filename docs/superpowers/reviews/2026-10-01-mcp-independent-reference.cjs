// Run from repository root. This audit uses only reviewed CSVs and Decimal,
// never the query/explorer helpers or a captured application response.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = process.cwd();
const appRequire = require("node:module").createRequire(path.join(root, "apps/web/package.json"));
const { parse } = appRequire("csv-parse/sync");
const Decimal = appRequire("decimal.js");
const D = Decimal.clone({ precision: 100 });
const read = file => parse(fs.readFileSync(path.join(root, file)), { columns: true, bom: true });
const facts = read("data/imports/cpi-products-monthly.csv");
const catalogue = read("data/imports/cpi-products.csv");
const manifest = read("docs/Raw Data/Inflation/geostat-products/2026-08/source-manifest.csv");
const annual = facts.filter(row => row.measure === "yoy_index_100" && row.period === "2026-08" && row.index_100 !== "");
const descending = [...annual].sort((a, b) => new D(b.index_100).comparedTo(a.index_100) || a.product_id.localeCompare(b.product_id));
const ascending = [...annual].sort((a, b) => new D(a.index_100).comparedTo(b.index_100) || a.product_id.localeCompare(b.product_id));
const cumulativeInputs = facts.filter(row => row.product_id === "cpi.product.p0001" && row.measure === "mom_index_100" && row.period.startsWith("2025-")).sort((a, b) => a.period.localeCompare(b.period));
if (cumulativeInputs.length !== 12 || cumulativeInputs.some(row => row.index_100 === "")) throw new Error("Incomplete reviewed cumulative reference");
const rowEvidence = row => ({ productId: row.product_id, measure: row.measure, period: row.period, index100: row.index_100, availability: row.availability, sourceId: row.source_id, locator: row.source_locator });
const rankedEvidence = rows => rows.slice(0, 5).map(row => ({ ...rowEvidence(row), percent: new D(row.index_100).minus(100).toString() }));
const output = {
  method: "Direct csv-parse rows; Decimal precision 100; no application helpers",
  factCount: facts.length, rosterCount: catalogue.length,
  publishedAnnualCandidates: annual.length,
  missingMonthlyInputs: facts.filter(row => row.measure === "mom_index_100" && row.index_100 === "").length,
  annual: { ...rowEvidence(annual.find(row => row.product_id === "cpi.product.p0001")), percent: new D(annual.find(row => row.product_id === "cpi.product.p0001").index_100).minus(100).toString() },
  cumulative: { basePeriod: "2024-12", inputs: cumulativeInputs.map(rowEvidence), percent: cumulativeInputs.reduce((value, row) => value.mul(new D(row.index_100).div(100)), new D(1)).minus(1).mul(100).toString() },
  annualTopFive: rankedEvidence(descending), annualBottomFive: rankedEvidence(ascending),
  annualSourceMissing: rowEvidence(facts.find(row => row.product_id === "cpi.product.p0089" && row.measure === "yoy_index_100" && row.period === "2019-01")),
  lateStart: catalogue.find(row => row.product_id === "cpi.product.p0051"),
  archives: manifest.filter(row => row.language === "en").map(row => {
    const bytes = fs.readFileSync(path.join(root, "docs/Raw Data/Inflation/geostat-products/2026-08", row.local_file));
    const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    if (sha256 !== row.sha256 || bytes.length !== Number(row.bytes)) throw new Error("Archive evidence mismatch");
    return { sourceId: row.source_id, officialUrl: row.retrieved_file_url, archive: row.local_file, sha256, bytes: bytes.length };
  }),
};
fs.writeFileSync(path.join(__dirname, "2026-10-01-mcp-independent-reference.json"), JSON.stringify(output, null, 2) + "\n");
process.stdout.write(JSON.stringify({ roster: output.rosterCount, annual: output.annual.percent, cumulative: output.cumulative.percent, monthlyGaps: output.missingMonthlyInputs }) + "\n");
