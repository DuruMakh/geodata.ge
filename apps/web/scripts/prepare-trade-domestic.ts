import path from "node:path";
import { prepareTradeDomesticData } from "../lib/data/tradeDomestic/prepareTradeDomestic";

const mode = process.argv.includes("--write") ? "write" : "check";
prepareTradeDomesticData(path.resolve(process.cwd(), "../.."), mode).catch(error => { console.error(error); process.exitCode = 1; });
