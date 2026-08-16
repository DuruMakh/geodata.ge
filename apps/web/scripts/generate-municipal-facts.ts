import { generateMunicipalFactCsvs } from "../lib/data/municipal/generateMunicipalFacts";

async function main() {
  const { functionRows, totalRows, countryFunctionRows, countryTotalRows } = await generateMunicipalFactCsvs();
  console.log(`Wrote municipal function facts: ${functionRows}`);
  console.log(`Wrote municipal total facts: ${totalRows}`);
  console.log(`Wrote Georgia municipal function facts: ${countryFunctionRows}`);
  console.log(`Wrote Georgia municipal total facts: ${countryTotalRows}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
