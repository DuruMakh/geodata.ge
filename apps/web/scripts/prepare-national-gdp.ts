import { prepareNationalGdp } from "../lib/data/nationalGdp/prepareNationalGdp";

async function main() {
  const write = process.argv.includes("--write");
  const result = await prepareNationalGdp({ write });

  console.log(
    `${write ? "Prepared" : "Validated"} ${result.canonicalFacts.length} national GDP facts (${result.validation.canonicalYearMin}–${result.validation.canonicalYearMax}).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
