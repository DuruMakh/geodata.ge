import fs from "node:fs/promises";
import path from "node:path";
import { loadEnglishCatalogue } from "../lib/i18n/catalogue.server";
import {
  loadRegionalEconomyFacts,
  REGIONAL_ECONOMY_REGIONS,
  REGIONAL_ECONOMY_SECTORS,
} from "../lib/data/regionalEconomies/importRegionalEconomies";
import { REGIONAL_GDP_TOTAL } from "../lib/data/regionalEconomies/types";
import { assertGeneratedArtifactMatches } from "../lib/data/generatedArtifacts";
import { buildRegionalEconomiesCsv } from "../lib/factQuery/publications";

async function main() {
  const repositoryRoot = path.resolve(process.cwd(), "../..");
  const [facts, catalogue] = await Promise.all([
    loadRegionalEconomyFacts(),
    loadEnglishCatalogue(repositoryRoot),
  ]);
  const registry = [
    { id: REGIONAL_GDP_TOTAL, classificationCode: null, sortOrder: 0, officialName: "Total regional GDP", labelKa: "რეგიონის მთლიანი მშპ", labelEn: "Total regional GDP" },
    ...REGIONAL_ECONOMY_SECTORS,
  ];
  const localization = {
    labelsEn: Object.fromEntries(REGIONAL_ECONOMY_REGIONS.map((region) => [region.id, catalogue.labels[region.id]!.text])),
  };
  const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
  const orderedFacts = [...facts].sort((left, right) =>
    compare(left.regionId, right.regionId) ||
    compare(left.seriesId, right.seriesId) ||
    compare(left.measure, right.measure) ||
    left.year - right.year,
  );
  const { bytes } = buildRegionalEconomiesCsv({
    regionalEconomies: { facts: orderedFacts, regions: REGIONAL_ECONOMY_REGIONS, registry },
    localization,
  });
  const file = path.resolve("public/downloads/data/regional-economies.csv");
  if (process.argv.includes("--check")) {
    await assertGeneratedArtifactMatches("public regional economies", file, bytes.toString("utf8"));
  } else {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes);
  }
  console.log(`Regional economies public CSV: ${facts.length} observations`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
