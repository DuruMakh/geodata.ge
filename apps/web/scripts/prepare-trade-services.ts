import path from "node:path";
import { prepareTradeServicesData } from "../lib/data/tradeServices/prepareTradeServices";

const mode = process.argv.includes("--write") ? "write" : "check";
prepareTradeServicesData(path.resolve(process.cwd(), "../.."), mode).catch(error => { console.error(error); process.exitCode = 1; });
