import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildMunicipalPopulation2025Output } from "../lib/data/municipal/prepareMunicipalPopulation2025";

const OUTPUT_PATH = path.resolve(process.cwd(), "../../data/imports/municipal-population-2025.csv");

export async function main(args: readonly string[]) {
  const [mode] = args;
  if (!mode || !["--write", "--check"].includes(mode) || args.length !== 1) {
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
