import { pathToFileURL } from "node:url";
import { prepareGeneralGovernmentBalance } from "../lib/data/generalGovernmentBalance/prepareGeneralGovernmentBalance";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-general-government-balance.ts --write|--check");
  }

  const write = args[0] === "--write";
  const result = await prepareGeneralGovernmentBalance({ write, checkArtifacts: true });
  console.log(
    `${write ? "Prepared" : "Validated"} ${result.canonicalFacts.length} general-government balance facts (${result.validation.canonicalYearMin}-${result.validation.canonicalYearMax}).`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
