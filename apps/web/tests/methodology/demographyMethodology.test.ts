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

  it("archives exactly the four Geostat originals it serves, with their recorded hashes", async () => {
    const rows = await loadReviewedSourceManifest(root, "demography");
    expect(rows.map((row) => [row.source_id, row.byte_size, row.sha256])).toEqual([
      ["source.geostat_demography_density", 13_917, "77d29d84cb7530f4fb6294f17a768e220f02636d77debfc438509b5c17ac28b8"],
      ["source.geostat_municipal_population", 34_994, "8bd7a1b56e756e8d6bc92192095795b204b23fd18274aaff39b78c0b0a487a57"],
      ["source.geostat_demography_migration_citizenship", 25_694, "6b7fc1d8714e3acacaa5167b8e7c424a3ddb2a13f9c60a95cbd700cd83bb20a0"],
      ["source.geostat_demography_net_migration", 11_440, "05aedd93e72ba63ab12b13feec8c46d6ce8870dadef3ece94fc7b87f65fa2196"],
    ]);
    expect(rows.every((row) => row.downloadHref.startsWith("/downloads/methodology/demography/files/"))).toBe(true);
    expect(rows.map((row) => [row.years[0], row.years.at(-1)])).toEqual([[2014, 2026], [2004, 2026], [2012, 2025], [2012, 2025]]);
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
      "Number of immigrants and emigrants by sex and citizenship",
      "Net migration (number and rate)",
    ]);
  });
});
