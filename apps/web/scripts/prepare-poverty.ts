import path from "node:path";
import { preparePovertyData } from "../lib/data/poverty/preparePoverty";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-poverty.ts --write | --check");
  }
  await preparePovertyData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check");
  console.log(JSON.stringify({ status: "passed", scope: "poverty_annual" }));
}

runAsCli(import.meta.url, main);
