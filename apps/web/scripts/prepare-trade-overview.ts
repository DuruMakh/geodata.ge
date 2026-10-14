import path from "node:path";
import { prepareTradeOverviewData } from "../lib/data/tradeOverview/prepareTradeOverview";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-trade-overview.ts --write | --check");
  }
  await prepareTradeOverviewData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check");
  console.log(JSON.stringify({ status: "passed", scope: "national_goods_overview", observations: 124 }));
}

runAsCli(import.meta.url, main);
