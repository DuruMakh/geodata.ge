import { pathToFileURL } from "node:url";
import { writeEconomicSectorsArtifacts } from "../lib/data/economicSectors/prepareEconomicSectors";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-economic-sectors.ts --write | --check");
  }
  const result = await writeEconomicSectorsArtifacts(args[0] === "--write");
  console.log(JSON.stringify({ status: result.status, counts: result.counts, missingCells: result.missingCells.length, reconciledYears: result.reconciliation.length, growthChecks: result.growthChecks.length }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
