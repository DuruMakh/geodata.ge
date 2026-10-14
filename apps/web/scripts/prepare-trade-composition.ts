import path from "node:path";
import { prepareTradeCompositionData } from "../lib/data/tradeComposition/prepareTradeComposition";

const mode = process.argv.includes("--write") ? "write" : "check";
prepareTradeCompositionData(path.resolve(process.cwd(), "../.."), mode).catch(error => { console.error(error); process.exitCode = 1; });
