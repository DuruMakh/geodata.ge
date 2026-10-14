import path from "node:path";
import { prepareMoneyBanksData } from "../lib/data/moneyBanks/prepareMoneyBanks";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-money-banks.ts --write | --check");
  }
  await prepareMoneyBanksData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check");
  console.log(JSON.stringify({ status: "passed", scope: "money_banks_annual" }));
}

runAsCli(import.meta.url, main);
