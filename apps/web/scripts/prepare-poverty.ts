import path from "node:path";
import { preparePovertyData } from "../lib/data/poverty/preparePoverty";

const args = process.argv.slice(2);
if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
  console.error("Usage: prepare-poverty.ts --write | --check");
  process.exitCode = 1;
} else {
  preparePovertyData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check")
    .then(() => console.log(JSON.stringify({ status: "passed", scope: "poverty_annual" })))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
