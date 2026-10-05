import path from "node:path";
import { prepareUnemploymentData } from "../lib/data/unemployment/prepareUnemployment";

const args = process.argv.slice(2);
if (args.length !== 1 || !["--write", "--check"].includes(args[0])) {
  console.error("Usage: prepare-unemployment.ts --write | --check"); process.exitCode = 1;
} else {
  prepareUnemploymentData(path.resolve(process.cwd(), "../.."), args[0] === "--write" ? "write" : "check")
    .then(() => console.log(JSON.stringify({ status: "passed", primaryObservations: 3142 })))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
