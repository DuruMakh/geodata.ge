import path from "node:path";
import { prepareCurrentAccountData } from "../lib/data/externalFlows/prepareCurrentAccount";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-current-account.ts --write | --check");
  }
  await prepareCurrentAccountData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check");
  console.log(JSON.stringify({ status: "passed", scope: "annual_current_account" }));
}

runAsCli(import.meta.url, main);
