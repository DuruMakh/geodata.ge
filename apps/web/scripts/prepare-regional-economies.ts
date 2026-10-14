import path from "node:path";
import { writeRegionalEconomyArtifacts } from "../lib/data/regionalEconomies/prepareRegionalEconomies";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  const write = args.includes("--write");
  const check = args.includes("--check");
  if (write === check) throw new Error("Use exactly one of --write or --check");

  const report = await writeRegionalEconomyArtifacts(write, path.resolve(process.cwd(), "../.."));
  console.log(JSON.stringify(report, null, 2));
}

runAsCli(import.meta.url, main);
