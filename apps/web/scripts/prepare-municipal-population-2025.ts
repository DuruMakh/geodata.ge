import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildMunicipalPopulation2025Output } from "../lib/data/municipal/prepareMunicipalPopulation2025";

const OUTPUT_PATH = path.resolve(process.cwd(), "../../data/imports/municipal-population-2025.csv");

async function main() {
  const [mode] = process.argv.slice(2);
  if (!mode || !["--write", "--check"].includes(mode) || process.argv.length !== 3) {
    throw new Error("Usage: prepare-municipal-population-2025.ts --write|--check");
  }

  const result = await buildMunicipalPopulation2025Output();
  if (mode === "--write") {
    await writeFile(OUTPUT_PATH, result.csvText, "utf8");
    console.log(`Prepared ${result.rows.length} municipal population facts for 2025.`);
    return;
  }

  const current = await readFile(OUTPUT_PATH, "utf8").catch(() => "");
  if (current !== result.csvText) {
    throw new Error(
      "Stale municipal population output: run npm run data:prepare-municipal-population",
    );
  }
  console.log(`Validated ${result.rows.length} municipal population facts for 2025.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
