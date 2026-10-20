import path from "node:path";
import { prepareLabourData } from "../lib/data/labour/prepareLabour";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-labour.ts --write | --check");
  }
  await prepareLabourData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check");
  console.log(JSON.stringify({ status: "passed", scope: "labour_annual" }));
}

runAsCli(import.meta.url, main);
