import path from "node:path";
import { prepareEnvironmentData } from "../lib/data/environment/prepareEnvironment";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-environment.ts --write | --check");
  }
  await prepareEnvironmentData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check");
  console.log(JSON.stringify({ status: "passed", scope: "environment_annual" }));
}

runAsCli(import.meta.url, main);
