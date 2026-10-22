import fs from "node:fs";
import path from "node:path";
import { createGunzip, gunzipSync } from "node:zlib";
import { parse } from "csv-parse";
import { parse as parseSync } from "csv-parse/sync";
import Decimal from "decimal.js";
import type { CleanStats } from "./clean";
import { PERSONAL_NUMBER_RUN } from "./privacy";


function filesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

/** Throws, naming the file, if any cleaned or registry file holds what looks like a personal number. */
function assertNoPersonalNumbers(dataDir: string) {
  for (const file of [...filesUnder(path.join(dataDir, "clean")), ...filesUnder(path.join(dataDir, "registry"))]) {
    const bytes = fs.readFileSync(file);
    const text = (file.endsWith(".gz") ? gunzipSync(bytes) : bytes).toString("utf8");
    if (PERSONAL_NUMBER_RUN.test(text)) throw new Error(`${file} contains an 11-digit number that may be a personal ID; nothing was reported`);
  }
}

type Control = { year: string; tenders_announced: string; simplified_total_gel: string; report_file: string; page: string };

const signed = (value: Decimal) => (value.isZero() ? "0" : value.isNegative() ? `−${value.abs().toString()}` : `+${value.toString()}`);
const fileYear = (file: string) => /_(\d{4})\.xlsx$/.exec(file)![1];

async function purchaseTotals(dataDir: string) {
  const totals = new Map<string, { gel: Decimal; other: Record<string, number> }>();
  let lastDate = "";
  for (const name of fs.readdirSync(path.join(dataDir, "clean")).filter(n => /^purchases_\d{4}\.csv\.gz$/.test(n)).sort()) {
    const year = name.slice(10, 14);
    const total = { gel: new Decimal(0), other: {} as Record<string, number> };
    totals.set(year, total);
    const rows = fs.createReadStream(path.join(dataDir, "clean", name)).pipe(createGunzip()).pipe(parse({ bom: true, columns: true }));
    for await (const row of rows as AsyncIterable<Record<string, string>>) {
      if (row.currency === "GEL" && row.contract_value) total.gel = total.gel.plus(row.contract_value);
      else if (row.currency) total.other[row.currency] = (total.other[row.currency] ?? 0) + 1;
      if (row.contract_date > lastDate) lastDate = row.contract_date;
    }
  }
  return { totals, lastDate: lastDate.slice(0, 10) };
}

function registryCoverage(dataDir: string) {
  const file = path.join(dataDir, "registry", "status.csv");
  if (!fs.existsSync(file)) return "Owners and directors: not collected yet.";
  const latest = new Map<string, string>();
  for (const row of parseSync(fs.readFileSync(file), { bom: true, columns: true }) as Record<string, string>[]) latest.set(row.code, row.status);
  const count = (status: string) => [...latest.values()].filter(s => s === status).length;
  return `Owners and directors: ${latest.size} companies looked up: ${count("found")} found, ${count("not_found")} not found, ${count("failed")} failed.`;
}

/** Writes data-report.md: the files' counts and totals against the agency's yearly reports, coverage and gaps. */
export async function buildReport(dataDir: string): Promise<string> {
  assertNoPersonalNumbers(dataDir);
  const stats = JSON.parse(fs.readFileSync(path.join(dataDir, "clean", "stats.json"), "utf8")) as CleanStats[];
  const controls = new Map((parseSync(fs.readFileSync(path.join(dataDir, "control-totals.csv")), { bom: true, columns: true }) as Control[]).map(c => [c.year, c]));
  const { totals, lastDate } = await purchaseTotals(dataDir);

  const tenderLines = stats.filter(s => s.file.includes("/main_")).map(s => {
    const year = fileYear(s.file);
    const agency = controls.get(year)?.tenders_announced;
    return `| ${year} | ${s.rows} | ${agency || "—"} | ${agency ? signed(new Decimal(s.rows).minus(agency)) : "—"} |`;
  });
  const purchaseLines = stats.filter(s => s.file.includes("/simpified_")).map(s => {
    const year = fileYear(s.file);
    const total = totals.get(year) ?? { gel: new Decimal(0), other: {} };
    const agency = controls.get(year)?.simplified_total_gel;
    const other = Object.entries(total.other).map(([currency, n]) => `${currency} ${n}`).join(", ") || "—";
    return `| ${year} | ${s.rows} | ${total.gel.toString()} | ${agency || "—"} | ${agency ? signed(total.gel.minus(agency)) : "—"} | ${other} |`;
  });
  const quality = stats.map(s => `| ${s.file} | ${s.duplicateIds} | ${s.wonWithoutSupplier} | ${Object.entries(s.currencies).map(([c, n]) => `${c} ${n}`).join(", ")} |`);

  const report = [
    "# Procurement data: collection report",
    "",
    `Written ${new Date().toISOString().slice(0, 10)}. Source: Tender Monitor (Transparency International Georgia) yearly files; control figures from the State Procurement Agency's annual reports (control-totals.csv names the file and page of each).`,
    "",
    "## Tenders: rows in the files against the agency's count of tenders announced",
    "",
    "| Year | Rows | Agency | Difference |",
    "|---|---|---|---|",
    ...tenderLines,
    "",
    "## Direct purchases: GEL totals against the agency's simplified-purchase total",
    "",
    "| Year | Contracts | GEL in files | Agency GEL | Difference | Other currencies (contracts) |",
    "|---|---|---|---|---|---|",
    ...purchaseLines,
    "",
    `The last direct purchase in the files is dated ${lastDate || "—"}. Later direct purchases are not in Tender Monitor's yearly files.`,
    "",
    "## File checks",
    "",
    "| File | Duplicate numbers | Contract signed but no supplier | Currencies (rows) |",
    "|---|---|---|---|",
    ...quality,
    "",
    "No 11-digit personal number was found in the cleaned tables or the saved registry answers.",
    "",
    registryCoverage(dataDir),
    "",
  ].join("\n");
  fs.writeFileSync(path.join(dataDir, "data-report.md"), report);
  return report;
}
