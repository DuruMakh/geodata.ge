import path from "node:path";
import { prepareHouseholdData } from "../lib/data/household/prepareHousehold";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-household-income.ts --write | --check");
  }
  await prepareHouseholdData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check");
  console.log(JSON.stringify({ status: "passed", scope: "household_income_spending_annual" }));
}

runAsCli(import.meta.url, main);
