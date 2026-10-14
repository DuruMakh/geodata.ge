import path from "node:path";
import { prepareTradeCompositionData } from "../lib/data/tradeComposition/prepareTradeComposition";
import { runAsCli } from "../lib/runAsCli";

export async function main(args: readonly string[]) {
  const mode = args.includes("--write") ? "write" : "check";
  await prepareTradeCompositionData(path.resolve(process.cwd(), "../.."), mode);
}

runAsCli(import.meta.url, main);
