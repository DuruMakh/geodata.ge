import { buildGovernmentDebtPackage } from "../lib/data/governmentDebt/prepareGovernmentDebtPackage";
import { prepareGovernmentDebtFacts } from "../lib/data/governmentDebt/importGovernmentDebtFacts";

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-government-debt.ts --write|--check");
  }
  const write = args[0] === "--write";
  const result = await buildGovernmentDebtPackage({ write });
  const servedFactCount = await prepareGovernmentDebtFacts({ write });

  console.log(
    `${write ? "Prepared" : "Validated"} the government debt research package.`,
  );
  console.log(`Stock rows: ${result.stockRows.length}`);
  console.log(`Actual service rows: ${result.actualServiceRows.length}`);
  console.log(`Interest-rate rows: ${result.interestRateRows.length}`);
  console.log(`Forecast rows: ${result.forecastRows.length}`);
  console.log(`Serving facts: ${servedFactCount}`);
  console.log(`Validation: ${result.validation.status}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
