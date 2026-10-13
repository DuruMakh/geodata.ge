import path from "node:path";
import { checkNominalGdpConsistency } from "../lib/data/nominalGdpConsistency";
import { runAsCli } from "../lib/runAsCli";

export async function main(): Promise<void> {
  const report = await checkNominalGdpConsistency(path.resolve(process.cwd(), "../.."));
  console.log(
    `Nominal GDP artifacts agree for ${report.years[0]}–${report.years.at(-1)} (${report.comparisons} comparisons).`,
  );
}

runAsCli(import.meta.url, main);
