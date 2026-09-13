import { writeEconomicSectorsArtifacts } from "../lib/data/economicSectors/prepareEconomicSectors";

const args = process.argv.slice(2);
if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
  console.error("Usage: prepare-economic-sectors.ts --write | --check");
  process.exitCode = 1;
} else {
  writeEconomicSectorsArtifacts(args[0] === "--write")
    .then(result => console.log(JSON.stringify({ status: result.status, counts: result.counts, missingCells: result.missingCells.length, reconciledYears: result.reconciliation.length, growthChecks: result.growthChecks.length }, null, 2)))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
