import path from "node:path";
import { prepareMoneyBanksData } from "../lib/data/moneyBanks/prepareMoneyBanks";

const args = process.argv.slice(2);
if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
  console.error("Usage: prepare-money-banks.ts --write | --check");
  process.exitCode = 1;
} else {
  prepareMoneyBanksData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check")
    .then(() => console.log(JSON.stringify({ status: "passed", scope: "money_banks_annual" })))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
