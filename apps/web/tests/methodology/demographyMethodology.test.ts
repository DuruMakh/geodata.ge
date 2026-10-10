import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadEnglishCatalogue } from "../../lib/i18n/catalogue.server";
import { validateMethodologyTranslation } from "../../lib/i18n/methodology";
import { getMethodologyContent, LIVE_METHODOLOGY_IDS } from "../../lib/methodology/catalog";
import { METHODOLOGY_TRANSLATION_REVIEWED_AT } from "../../lib/methodology/content/en/revisions";
import { projectPublicSources } from "../../lib/methodology/publicSources";
import { loadReviewedSourceManifest } from "../../lib/methodology/sourceManifest";

const root = path.resolve(process.cwd(), "../..");

describe("demography methodology", () => {
  it("is a live dataset with a valid Georgian-to-English translation", () => {
    expect(LIVE_METHODOLOGY_IDS.at(-1)).toBe("demography");
    expect(validateMethodologyTranslation(
      getMethodologyContent("demography", "ka"),
      getMethodologyContent("demography", "en"),
      METHODOLOGY_TRANSLATION_REVIEWED_AT.demography,
    )).toEqual([]);
  });

  it("states its scope, the census re-base and the area convention in plain words, in both languages", () => {
    for (const locale of ["ka", "en"] as const) {
      const content = getMethodologyContent("demography", locale);
      const prose = [content.summary, content.disclosure, ...content.sections.flatMap((section) => section.paragraphs)].join(" ");
      expect(prose).toContain("2004–2026");
      expect(prose).toContain("504.24");
      expect(prose).toMatch(locale === "en" ? /re-based the population to the 2024 census/ : /2024 წლის აღწერაზე დააფუძნა/);
      expect(prose).toMatch(locale === "en" ? /not compared/ : /არ შედარდება/);
      expect(prose).toMatch(locale === "en" ? /occupied territories/i : /ოკუპირებული ტერიტორიები/);
    }
  });

  it("dates the re-base by its day in the English disclosure: 1 January 2025, never a 2025 census", () => {
    // The census was taken in November 2024; the re-base applies from 1 January 2025.
    const { disclosure } = getMethodologyContent("demography", "en");
    expect(disclosure).toContain("1 January 2025");
    expect(disclosure).not.toContain("the 2025 census");
  });

  it("names the three bases in the exact English words the page shows", () => {
    const content = getMethodologyContent("demography", "en");
    const prose = [content.summary, content.disclosure, ...content.sections.flatMap((section) => section.paragraphs)].join(" ");
    for (const phrase of ["re-estimated in 2018", "estimated before the 2024 census", "based on the 2024 census"]) {
      expect(prose, phrase).toContain(phrase);
    }
  });

  it("archives exactly the twelve Geostat originals it serves, with their recorded hashes", async () => {
    const rows = await loadReviewedSourceManifest(root, "demography");
    expect(rows.map((row) => [row.source_id, row.byte_size, row.sha256])).toEqual([
      ["source.geostat_demography_density", 13_917, "77d29d84cb7530f4fb6294f17a768e220f02636d77debfc438509b5c17ac28b8"],
      ["source.geostat_municipal_population", 34_994, "8bd7a1b56e756e8d6bc92192095795b204b23fd18274aaff39b78c0b0a487a57"],
      ["source.geostat_demography_births", 26_206, "b8b2b0c352aa1e787925e896773b40aa7181d7b2c83bb05c9a1646c7f798a58d"],
      ["source.geostat_demography_crude_birth_rate", 10_365, "9a22452c6363f3b55f43487811fbf9169e6d94b01432a0f8ad393f39d63c55db"],
      ["source.geostat_demography_crude_death_rate", 10_249, "76c2f5d4a152d7e0241c0a7582efbc59c7b2a12d41243fee1a5fed9e3cfce07e"],
      ["source.geostat_demography_deaths", 25_857, "e3f63ef59c1dc81973d38077b062ddc7d63fb4c77650358f7a5295ebeb911a5f"],
      ["source.geostat_demography_fertility", 12_201, "86bf7dc84062e4356cd62626dcda9bbf0e9bb56a74e063e08b1dfa04413a75aa"],
      ["source.geostat_demography_infant_mortality", 11_517, "ca9e127b04eeef4be4af0038ffc4605ed11fddddb14b38f7b432e5a6753160d1"],
      ["source.geostat_demography_life_expectancy", 11_040, "fc679c041fe6190848056081977afa8d0e17db103667176a5c02e918d70fb6d6"],
      ["source.geostat_demography_migration_citizenship", 25_694, "6b7fc1d8714e3acacaa5167b8e7c424a3ddb2a13f9c60a95cbd700cd83bb20a0"],
      ["source.geostat_demography_natural_increase", 26_528, "db4c2d808f17936de45cf5b8be6eb2f7c267c9b09ce7a182f873c3fd4591417e"],
      ["source.geostat_demography_net_migration", 11_440, "05aedd93e72ba63ab12b13feec8c46d6ce8870dadef3ece94fc7b87f65fa2196"],
    ]);
    expect(rows.every((row) => row.downloadHref.startsWith("/downloads/methodology/demography/files/"))).toBe(true);
    expect(rows.map((row) => [row.years[0], row.years.at(-1)])).toEqual([[2014, 2026], [2004, 2026], ...Array(7).fill([2014, 2025]), [2012, 2025], [2014, 2025], [2012, 2025]]);
  });

  it("keeps the UTF-8 BOM on its Georgian archive manifest, as AGENTS.md requires of Georgian methodology manifests", async () => {
    const file = "data/methodology/source-archives/demography.csv";
    const bytes = await readFile(path.join(root, file));
    expect([...bytes.subarray(0, 3)], `${file} must start with the UTF-8 BOM bytes EF BB BF`).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("has an English title for each archived source", async () => {
    const [catalogue, rows] = await Promise.all([loadEnglishCatalogue(root), loadReviewedSourceManifest(root, "demography")]);
    expect(projectPublicSources(rows, "en", catalogue.documents).map((row) => row.title)).toEqual([
      "Density by regions (number of population per 1 sq.km)",
      "Population as of 1 January by regions and self-governed units",
      "Number of live births by regions and self-governed units",
      "Crude birth rate (Live births per 1 000 population)",
      "Crude death rate (death per 1 000 population)",
      "Number of deaths by regions and self-governed units",
      "Age specific fertility rates and total fertility rate (TFR)",
      "Infant mortality rate by sex (infant deaths per 1,000 live births)",
      "Life expectancy at births by sex",
      "Number of immigrants and emigrants by sex and citizenship",
      "Natural increase by regions and self-governed units",
      "Net migration (number and rate)",
    ]);
  });
});
