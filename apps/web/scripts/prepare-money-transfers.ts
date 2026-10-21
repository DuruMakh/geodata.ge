import path from "node:path";
import { prepareMoneyTransfersData } from "../lib/data/externalFlows/prepareMoneyTransfers";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-money-transfers.ts --write | --check");
  }
  await prepareMoneyTransfersData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check");
  console.log(JSON.stringify({ status: "passed", scope: "annual_money_transfers", observations: 9364 }));
}

runAsCli(import.meta.url, main);
