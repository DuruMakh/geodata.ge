import fs from "node:fs/promises";
import path from "node:path";
import { loadGdpOverviewFacts } from "../lib/data/gdpOverview/importGdpOverview";
import { csvEscape } from "../lib/data/csvEscape";
import { assertGeneratedArtifactMatches } from "../lib/data/generatedArtifacts";
async function main() {
  const facts = await loadGdpOverviewFacts();
  const content =
    "\uFEFFseries_id,year,value,unit,status,source_id\n" +
    facts
      .map((f) =>
        [f.seriesId, f.year, f.value, f.unit, f.status, f.sourceId]
          .map(csvEscape)
          .join(","),
      )
      .join("\n") +
    "\n";
  const file = path.join(
    process.cwd(),
    "public/downloads/data/gdp-overview.csv",
  );
  if (process.argv.includes("--check"))
    await assertGeneratedArtifactMatches("public GDP", file, content);
  else {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
  }
  console.log(`GDP public CSV: ${facts.length} observations`);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
