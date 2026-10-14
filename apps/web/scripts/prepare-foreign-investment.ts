import path from "node:path";
import { prepareForeignInvestmentData } from "../lib/data/externalFlows/prepareForeignInvestment";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-foreign-investment.ts --write | --check");
  }
  await prepareForeignInvestmentData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check");
  console.log(JSON.stringify({ status: "passed", scope: "annual_foreign_direct_investment" }));
}

runAsCli(import.meta.url, main);
