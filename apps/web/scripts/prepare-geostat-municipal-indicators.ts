import { buildGeostatPackage } from "../lib/data/municipalIndicators/prepareGeostatPackage";

async function main() {
  const result = await buildGeostatPackage({ write: true });
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
