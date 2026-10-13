import path from "node:path";
import { writeDemographyArtifacts } from "../lib/data/demography/prepareDemography";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  const write = args.includes("--write");
  const check = args.includes("--check");
  if (write === check) throw new Error("Use exactly one of --write or --check");

  const report = await writeDemographyArtifacts(write, path.resolve(process.cwd(), "../.."));
  const rows: Record<string, number> = {};
  for (const entry of report.coverage) rows[entry.family] = (rows[entry.family] ?? 0) + entry.rows;
  console.log(
    JSON.stringify(
      { mode: write ? "write" : "check", rows, censusStep: report.balancing.censusStep, censusAnchor: report.censusAnchor, ratesWithinBound: report.rates.length },
      null,
      2,
    ),
  );
}

runAsCli(import.meta.url, main);
