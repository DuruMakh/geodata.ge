import path from "node:path";
import { prepareExternalPositionData } from "../lib/data/externalPosition/prepareExternalPosition";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-external-position.ts --write | --check");
  }
  await prepareExternalPositionData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check");
  console.log(JSON.stringify({ status: "passed", scope: "external_position_annual" }));
}

runAsCli(import.meta.url, main);
