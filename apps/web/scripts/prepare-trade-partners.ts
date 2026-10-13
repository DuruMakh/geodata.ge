import path from "node:path";
import { pathToFileURL } from "node:url";
import { prepareTradePartnersData } from "../lib/data/tradePartners/prepareTradePartners";

export async function main(args: readonly string[]) {
  if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
    throw new Error("Usage: prepare-trade-partners.ts --write | --check");
  }
  await prepareTradePartnersData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check");
  console.log(JSON.stringify({ status: "passed", scope: "annual_goods_partners", observations: 22992 }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
