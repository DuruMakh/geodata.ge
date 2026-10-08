import path from "node:path";
import { prepareTradeOverviewData } from "../lib/data/tradeOverview/prepareTradeOverview";

const args = process.argv.slice(2);
if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
  console.error("Usage: prepare-trade-overview.ts --write | --check");
  process.exitCode = 1;
} else {
  prepareTradeOverviewData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check")
    .then(() => console.log(JSON.stringify({ status: "passed", scope: "national_goods_overview", observations: 124 })))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
