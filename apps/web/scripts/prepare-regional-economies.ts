import path from "node:path";
import { pathToFileURL } from "node:url";
import { writeRegionalEconomyArtifacts } from "../lib/data/regionalEconomies/prepareRegionalEconomies";

export async function main(args: readonly string[]) {
  const write = args.includes("--write");
  const check = args.includes("--check");
  if (write === check) throw new Error("Use exactly one of --write or --check");

  const report = await writeRegionalEconomyArtifacts(write, path.resolve(process.cwd(), "../.."));
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
