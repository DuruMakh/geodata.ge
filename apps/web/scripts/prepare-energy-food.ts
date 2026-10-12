import path from "node:path";
import { prepareEnergyFoodData } from "../lib/data/energyFood/prepareEnergyFood";

const args = process.argv.slice(2);
if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
  console.error("Usage: prepare-energy-food.ts --write | --check");
  process.exitCode = 1;
} else {
  prepareEnergyFoodData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check")
    .then(() => console.log(JSON.stringify({ status: "passed", scope: "energy_food_annual" })))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
