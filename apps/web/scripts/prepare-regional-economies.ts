import path from "node:path";
import { writeRegionalEconomyArtifacts } from "../lib/data/regionalEconomies/prepareRegionalEconomies";

const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
if (write === check) throw new Error("Use exactly one of --write or --check");

writeRegionalEconomyArtifacts(write, path.resolve(process.cwd(), "../.."))
  .then((report) => console.log(JSON.stringify(report, null, 2)))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
