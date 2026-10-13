import path from "node:path";
import { prepareTradeServicesData } from "../lib/data/tradeServices/prepareTradeServices";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  const mode = args.includes("--write") ? "write" : "check";
  await prepareTradeServicesData(path.resolve(process.cwd(), "../.."), mode);
}

runAsCli(import.meta.url, main);
