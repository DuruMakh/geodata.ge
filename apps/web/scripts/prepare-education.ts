import path from "node:path";
import { prepareEducationData } from "../lib/data/education/prepareEducation";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-education.ts --write | --check");
  }
  await prepareEducationData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check");
  console.log(JSON.stringify({ status: "passed", scope: "education_annual" }));
}

runAsCli(import.meta.url, main);
