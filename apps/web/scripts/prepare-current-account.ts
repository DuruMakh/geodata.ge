import path from "node:path";
import { prepareCurrentAccountData } from "../lib/data/externalFlows/prepareCurrentAccount";
const args = process.argv.slice(2);
if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
  console.error("Usage: prepare-current-account.ts --write | --check"); process.exitCode = 1;
} else {
  prepareCurrentAccountData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check")
    .then(() => console.log(JSON.stringify({ status: "passed", scope: "annual_current_account" })))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
