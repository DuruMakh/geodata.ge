import path from "node:path";
import { pathToFileURL } from "node:url";
import { prepareTradeServicesData } from "../lib/data/tradeServices/prepareTradeServices";

export async function main(args: readonly string[]) {
  const mode = args.includes("--write") ? "write" : "check";
  await prepareTradeServicesData(path.resolve(process.cwd(), "../.."), mode);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
