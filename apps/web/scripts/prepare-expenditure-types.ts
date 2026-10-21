import { writeExpenditureTypesArtifacts } from "../lib/data/expenditureTypes/prepareExpenditureTypes";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-expenditure-types.ts --write | --check");
  }
  const result = await writeExpenditureTypesArtifacts(args[0] === "--write");
  console.log(JSON.stringify({ status: result.status, counts: result.counts, identityYears: result.identities.length }, null, 2));
}

runAsCli(import.meta.url, main);
