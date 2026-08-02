import { generateMunicipalFactCsvs } from "../lib/data/municipal/generateMunicipalFacts";

async function main() {
  const { functionRows, totalRows } = await generateMunicipalFactCsvs();
  console.log(`Wrote municipal function facts: ${functionRows}`);
  console.log(`Wrote municipal total facts: ${totalRows}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
