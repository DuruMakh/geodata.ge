import path from "node:path";
import { prepareHouseholdData } from "../lib/data/household/prepareHousehold";

const args = process.argv.slice(2);
if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
  console.error("Usage: prepare-household-income.ts --write | --check");
  process.exitCode = 1;
} else {
  prepareHouseholdData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check")
    .then(() => console.log(JSON.stringify({ status: "passed", scope: "household_income_spending_annual" })))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
