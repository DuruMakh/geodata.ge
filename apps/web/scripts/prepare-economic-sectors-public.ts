import fs from "node:fs/promises";
import path from "node:path";
import { loadEconomicSectorFacts, ECONOMIC_SECTORS } from "../lib/data/economicSectors/importEconomicSectors";
import { SECTOR_DEFINITIONS } from "../lib/factQuery/economicSectorsSeries";
import { buildEconomicSectorsCsv } from "../lib/factQuery/publications";
import { assertGeneratedArtifactMatches } from "../lib/data/generatedArtifacts";
async function main() {
  const facts = await loadEconomicSectorFacts();
  const { bytes } = buildEconomicSectorsCsv({economicSectors:{facts,registry:ECONOMIC_SECTORS,definitions:SECTOR_DEFINITIONS}});
  const file = path.resolve("public/downloads/data/economic-sectors.csv");
  if(process.argv.includes("--check")) await assertGeneratedArtifactMatches("public economic sectors",file,bytes.toString("utf8"));
  else {await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes);}
  console.log(`Economic sectors public CSV: ${facts.length} observations`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
