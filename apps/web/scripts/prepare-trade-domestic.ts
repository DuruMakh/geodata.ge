import path from "node:path";
import { prepareTradeDomesticData } from "../lib/data/tradeDomestic/prepareTradeDomestic";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  const mode = args.includes("--write") ? "write" : "check";
  await prepareTradeDomesticData(path.resolve(process.cwd(), "../.."), mode);
}

runAsCli(import.meta.url, main);
