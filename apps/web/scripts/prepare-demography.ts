import path from "node:path";
import { writeDemographyArtifacts } from "../lib/data/demography/prepareDemography";

const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
if (write === check) throw new Error("Use exactly one of --write or --check");

writeDemographyArtifacts(write, path.resolve(process.cwd(), "../.."))
  .then((report) => {
    const rows: Record<string, number> = {};
    for (const entry of report.coverage) rows[entry.family] = (rows[entry.family] ?? 0) + entry.rows;
    console.log(
      JSON.stringify(
        { mode: write ? "write" : "check", rows, censusStep: report.balancing.censusStep, censusAnchor: report.censusAnchor, ratesWithinBound: report.rates.length },
        null,
        2,
      ),
    );
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
