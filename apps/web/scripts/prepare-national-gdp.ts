import { prepareNationalGdp } from "../lib/data/nationalGdp/prepareNationalGdp";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-national-gdp.ts --write|--check");
  }
  const write = args[0] === "--write";
  const result = await prepareNationalGdp({ write });

  console.log(
    `${write ? "Prepared" : "Validated"} ${result.canonicalFacts.length} national GDP facts (${result.validation.canonicalYearMin}–${result.validation.canonicalYearMax}).`,
  );
}

runAsCli(import.meta.url, main);
