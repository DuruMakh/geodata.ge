import path from "node:path";
import { prepareForeignInvestmentData } from "../lib/data/externalFlows/prepareForeignInvestment";
const args = process.argv.slice(2);
if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
  console.error("Usage: prepare-foreign-investment.ts --write | --check"); process.exitCode = 1;
} else {
  prepareForeignInvestmentData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check")
    .then(() => console.log(JSON.stringify({ status: "passed", scope: "annual_foreign_direct_investment" })))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
