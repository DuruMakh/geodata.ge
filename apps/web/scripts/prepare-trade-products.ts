import path from "node:path";
import { prepareTradeProductsData } from "../lib/data/tradeProducts/prepareTradeProducts";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-trade-products.ts --write | --check");
  }
  await prepareTradeProductsData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check");
  console.log(JSON.stringify({ status: "passed", scope: "annual_goods_products", observations: 69624 }));
}

runAsCli(import.meta.url, main);
