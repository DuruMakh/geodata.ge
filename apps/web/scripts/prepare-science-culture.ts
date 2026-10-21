import path from "node:path";
import { prepareScienceCultureData } from "../lib/data/scienceCulture/prepareScienceCulture";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-science-culture.ts --write | --check");
  }
  await prepareScienceCultureData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check");
  console.log(JSON.stringify({ status: "passed", scope: "science_culture_annual" }));
}

runAsCli(import.meta.url, main);
