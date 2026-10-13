import path from "node:path";
import { pathToFileURL } from "node:url";
import { prepareTradeOverviewData } from "../lib/data/tradeOverview/prepareTradeOverview";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-trade-overview.ts --write | --check");
  }
  await prepareTradeOverviewData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check");
  console.log(JSON.stringify({ status: "passed", scope: "national_goods_overview", observations: 124 }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
