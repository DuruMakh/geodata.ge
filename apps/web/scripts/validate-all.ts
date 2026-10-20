import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runAsCli } from "../lib/runAsCli";

// `npm run data:validate`: every data check in one process, in this order, stopping at the first failure as the
// `&&` chain of 30 `npm run` steps it replaces did (each step paid about a second of process start-up). Each entry
// is the npm script that runs that check on its own. Its command must be `tsx scripts/<file>.ts [flags]`; this
// calls the file's exported `main` with the same flags, so a single check and the full gate cannot drift apart.
export const DATA_VALIDATE_CHECKS = [
  "data:validate-files",
  "data:check-national-gdp",
  "data:check-general-government-balance",
  "data:check-municipal-indicators",
  "data:check-municipal-population",
  "data:check-methodology-archives",
  "data:check-nominal-gdp-consistency",
  "data:validate-public-dataset-inputs",
  "data:check-government-debt",
  "data:check-fact-query-snapshot",
  "data:check-gdp-overview",
  "data:check-economic-sectors",
  "data:check-regional-economies",
  "data:check-inflation",
  "data:check-inflation-products",
  "data:check-demography",
  "data:check-unemployment",
  "data:check-trade-overview",
  "data:check-trade-partners",
  "data:check-trade-products",
  "data:check-trade-domestic",
  "data:check-trade-services",
  "data:check-trade-composition",
  "data:check-money-transfers",
  "data:check-foreign-investment",
  "data:check-wages",
  "data:check-current-account",
  "data:check-external-position",
  "data:check-poverty",
  "data:check-household-income",
  "data:check-energy-food",
  "data:check-health",
  "data:check-crime",
  "data:check-money",
  "data:check-business",
  "data:check-housing",
  "data:check-education",
  "data:check-labour",
] as const;

type Check = { main: (args: readonly string[]) => Promise<void> };

async function main() {
  const { scripts } = JSON.parse(await readFile("package.json", "utf8")) as { scripts: Record<string, string> };
  const started = performance.now();
  for (const name of DATA_VALIDATE_CHECKS) {
    const command = scripts[name] ?? "";
    const [runner, file, ...args] = command.split(" ");
    if (runner !== "tsx" || !/^scripts\/[\w-]+\.ts$/.test(file ?? "")) {
      throw new Error(`${name} must be "tsx scripts/<file>.ts [flags]", found "${command}"`);
    }
    console.log(`\n> ${name}\n> ${command}\n`);
    const check = (await import(pathToFileURL(path.resolve(file)).href)) as Check;
    await check.main(args);
  }
  console.log(`\n${DATA_VALIDATE_CHECKS.length} data checks passed in ${((performance.now() - started) / 1000).toFixed(1)}s`);
}

runAsCli(import.meta.url, main);
