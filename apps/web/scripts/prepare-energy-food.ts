import path from "node:path";
import { prepareEnergyFoodData } from "../lib/data/energyFood/prepareEnergyFood";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-energy-food.ts --write | --check");
  }
  await prepareEnergyFoodData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check");
  console.log(JSON.stringify({ status: "passed", scope: "energy_food_annual" }));
}

runAsCli(import.meta.url, main);
