import path from "node:path";
import { prepareTaxBreaksRefundsData } from "../lib/data/taxBreaksRefunds/prepareTaxBreaksRefunds";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-tax-breaks-refunds.ts --write | --check");
  }
  await prepareTaxBreaksRefundsData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check");
  console.log(JSON.stringify({ status: "passed", scope: "tax_breaks_refunds_annual" }));
}

runAsCli(import.meta.url, main);
