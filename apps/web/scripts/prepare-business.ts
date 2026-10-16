import path from "node:path";
import { prepareBusinessData } from "../lib/data/business/prepareBusiness";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-business.ts --write | --check");
  }
  await prepareBusinessData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check");
  console.log(JSON.stringify({ status: "passed", scope: "business_annual" }));
}

runAsCli(import.meta.url, main);
