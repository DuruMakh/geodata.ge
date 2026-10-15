import path from "node:path";
import { prepareHealthData } from "../lib/data/health/prepareHealth";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-health.ts --write | --check");
  }
  await prepareHealthData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check");
  console.log(JSON.stringify({ status: "passed", scope: "health_annual" }));
}

runAsCli(import.meta.url, main);
