import { prepareNationalGdp } from "../lib/data/nationalGdp/prepareNationalGdp";

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-national-gdp.ts --write|--check");
  }
  const write = args[0] === "--write";
  const result = await prepareNationalGdp({ write });

  console.log(
    `${write ? "Prepared" : "Validated"} ${result.canonicalFacts.length} national GDP facts (${result.validation.canonicalYearMin}–${result.validation.canonicalYearMax}).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
