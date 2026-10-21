import path from "node:path";
import { prepareUnemploymentData } from "../lib/data/unemployment/prepareUnemployment";
import { loadUnemploymentFacts } from "../lib/data/unemployment/importUnemployment";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-unemployment.ts --write | --check");
  }
  await prepareUnemploymentData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check");
  console.log(JSON.stringify({ status: "passed", primaryObservations: (await loadUnemploymentFacts()).length }));
}

runAsCli(import.meta.url, main);
