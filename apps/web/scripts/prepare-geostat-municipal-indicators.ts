import { buildGeostatPackage } from "../lib/data/municipalIndicators/prepareGeostatPackage";

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-geostat-municipal-indicators.ts --write|--check");
  }
  const write = args[0] === "--write";
  const result = await buildGeostatPackage({ write });

  console.log(`${write ? "Prepared" : "Validated"} the Geostat municipal indicators package.`);
  console.log(`Population rows: ${result.populationRows.length}`);
  console.log(`Regional GDP rows: ${result.regionalGdpRows.length}`);
  console.log(
    `Regional GDP years: ${result.validation.regionalGdp.observedYears.join(", ")}`,
  );
  console.log(`Validation: ${result.validation.status}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
