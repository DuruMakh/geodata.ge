import { writeEconomicSectorsArtifacts } from "../lib/data/economicSectors/prepareEconomicSectors";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-economic-sectors.ts --write | --check");
  }
  const result = await writeEconomicSectorsArtifacts(args[0] === "--write");
  console.log(JSON.stringify({ status: result.status, counts: result.counts, missingCells: result.missingCells.length, reconciledYears: result.reconciliation.length, growthChecks: result.growthChecks.length }, null, 2));
}

runAsCli(import.meta.url, main);
