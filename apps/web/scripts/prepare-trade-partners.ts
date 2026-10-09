import path from "node:path";
import { prepareTradePartnersData } from "../lib/data/tradePartners/prepareTradePartners";
const args = process.argv.slice(2);
if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
  console.error("Usage: prepare-trade-partners.ts --write | --check"); process.exitCode = 1;
} else {
  prepareTradePartnersData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check")
    .then(() => console.log(JSON.stringify({ status: "passed", scope: "annual_goods_partners", observations: 22992 })))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
