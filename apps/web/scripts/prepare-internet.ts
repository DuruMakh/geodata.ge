import path from "node:path";
import { prepareInternetData } from "../lib/data/internet/prepareInternet";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-internet.ts --write | --check");
  }
  await prepareInternetData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check");
  console.log(JSON.stringify({ status: "passed", scope: "internet_annual" }));
}

runAsCli(import.meta.url, main);
