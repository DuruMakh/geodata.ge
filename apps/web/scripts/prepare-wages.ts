import path from "node:path";
import { prepareWagesData } from "../lib/data/wages/prepareWages";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-wages.ts --write | --check");
  }
  await prepareWagesData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check");
  console.log(JSON.stringify({ status: "passed", scope: "wages_annual" }));
}

runAsCli(import.meta.url, main);
