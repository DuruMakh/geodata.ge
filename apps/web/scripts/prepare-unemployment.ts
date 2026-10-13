import path from "node:path";
import { pathToFileURL } from "node:url";
import { prepareUnemploymentData } from "../lib/data/unemployment/prepareUnemployment";
import { loadUnemploymentFacts } from "../lib/data/unemployment/importUnemployment";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-unemployment.ts --write | --check");
  }
  await prepareUnemploymentData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check");
  console.log(JSON.stringify({ status: "passed", primaryObservations: (await loadUnemploymentFacts()).length }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
