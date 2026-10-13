import path from "node:path";
import { pathToFileURL } from "node:url";
import { prepareEnergyFoodData } from "../lib/data/energyFood/prepareEnergyFood";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-energy-food.ts --write | --check");
  }
  await prepareEnergyFoodData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check");
  console.log(JSON.stringify({ status: "passed", scope: "energy_food_annual" }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
