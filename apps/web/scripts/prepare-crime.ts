import path from "node:path";
import { prepareCrimeData } from "../lib/data/crime/prepareCrime";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-crime.ts --write | --check");
  }
  await prepareCrimeData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check");
  console.log(JSON.stringify({ status: "passed", scope: "crime_annual" }));
}

runAsCli(import.meta.url, main);
