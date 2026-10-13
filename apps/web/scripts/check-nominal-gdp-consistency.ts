import path from "node:path";
import { pathToFileURL } from "node:url";
import { checkNominalGdpConsistency } from "../lib/data/nominalGdpConsistency";

export async function main(): Promise<void> {
  const report = await checkNominalGdpConsistency(path.resolve(process.cwd(), "../.."));
  console.log(
    `Nominal GDP artifacts agree for ${report.years[0]}–${report.years.at(-1)} (${report.comparisons} comparisons).`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
