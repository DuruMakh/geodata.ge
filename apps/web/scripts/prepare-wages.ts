import path from "node:path";
import { prepareWagesData } from "../lib/data/wages/prepareWages";

const args = process.argv.slice(2);
if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
  console.error("Usage: prepare-wages.ts --write | --check");
  process.exitCode = 1;
} else {
  prepareWagesData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check")
    .then(() => console.log(JSON.stringify({ status: "passed", scope: "wages_annual" })))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
