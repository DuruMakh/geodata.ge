import { writeGdpExpenditureArtifacts } from "../lib/data/gdpExpenditure/prepareGdpExpenditure";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-gdp-expenditure.ts --write | --check");
  }
  const result = await writeGdpExpenditureArtifacts(args[0] === "--write");
  console.log(JSON.stringify({ status: result.status, counts: result.counts, identityYears: result.identities.length, growthChecks: result.growthChecks.length }, null, 2));
}

runAsCli(import.meta.url, main);
