import path from "node:path";
import { prepareMoneyTransfersData } from "../lib/data/externalFlows/prepareMoneyTransfers";
const args = process.argv.slice(2);
if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
  console.error("Usage: prepare-money-transfers.ts --write | --check"); process.exitCode = 1;
} else {
  prepareMoneyTransfersData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check")
    .then(() => console.log(JSON.stringify({ status: "passed", scope: "annual_money_transfers", observations: 9364 })))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
