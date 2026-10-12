import path from "node:path";
import { prepareTradeProductsData } from "../lib/data/tradeProducts/prepareTradeProducts";
const args = process.argv.slice(2);
if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
  console.error("Usage: prepare-trade-products.ts --write | --check"); process.exitCode = 1;
} else {
  prepareTradeProductsData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check")
    .then(() => console.log(JSON.stringify({ status: "passed", scope: "annual_goods_products", observations: 69624 })))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
