import path from "node:path";
import { prepareHousingData } from "../lib/data/housing/prepareHousing";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-housing.ts --write | --check");
  }
  await prepareHousingData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check");
  console.log(JSON.stringify({ status: "passed", scope: "housing_annual" }));
}

runAsCli(import.meta.url, main);
