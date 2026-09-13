import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot, enrichSourceTranslations } from "../../lib/factQuery/buildSnapshot";
import { describeCoverage, type CoverageData } from "../../lib/factQuery/describeCoverage";
import { getSources, type GetSourcesData } from "../../lib/factQuery/getSources";
import { loadEnglishCatalogue } from "../../lib/i18n/catalogue.server";
import { validateServiceMessages } from "../../lib/i18n/validation";
import { hashDataVersion } from "../../lib/factQuery/canonical";
import { historicalProgrammeLabelEn, serviceLabelEn, serviceMessage } from "../../lib/factQuery/localization";
import type { FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;
beforeAll(async () => { snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-06T00:00:00Z" }); });

describe("snapshot-pinned translations", () => {
  it("covers every exposed catalogue identity, including excluded municipalities", () => {
    const overview = describeCoverage(snapshot, {});
    if (overview.kind !== "catalogue") throw new Error("Expected catalogue");
    for (const dataset of (overview.data as CoverageData).datasets) {
      expect(serviceLabelEn(snapshot, dataset.datasetId)).not.toBe("");
      const response = describeCoverage(snapshot, { datasetId: dataset.datasetId });
      if (response.kind !== "catalogue") throw new Error("Expected catalogue");
      const data = response.data as CoverageData;
      for (const id of [...(data.series ?? []).map(series => series.seriesId), ...(data.entities ?? []).map(entity => entity.entityId), ...data.exclusions.map(entity => entity.entityId)]) expect(serviceLabelEn(snapshot, id), id).not.toBe("");
    }
  });
  it("rejects unreviewed source companions and incomplete sentence contracts", async () => {
    const catalogue = await loadEnglishCatalogue("../..");
    const source = snapshot.sources.find(source => source.sourceId === "source.adjara_consolidated_budget")!;
    expect(() => enrichSourceTranslations([source], catalogue, {})).toThrow("sources.source.adjara_consolidated_budget.name");
    const messages = structuredClone(snapshot.localization.messages);
    messages.en["missing.seriesYear"] = "Missing {wrongYear}.";
    messages.en["publication.sumWarning"] = "ქართული ტექსტი";
    delete messages.ka["definitions.reviewedAmount"];
    const errors = validateServiceMessages(messages.ka, messages.en).join(" ");
    expect(errors).toContain("Changed service parameters");
    expect(errors).toContain("Untranslated service message");
    expect(errors).toContain("Missing service message");
  });
  it("resolves reviewed English names and fails when a label or historical record is missing", () => {
    expect(serviceLabelEn(snapshot, "spending.education")).toBe("Education");
    const programme = snapshot.ministries.facts.find(fact => fact.level === "major_program")!;
    expect(historicalProgrammeLabelEn(snapshot, programme.itemId, programme.year)).not.toMatch(/\p{Script=Georgian}/u);
    expect(() => serviceLabelEn(snapshot, "missing.label")).toThrow("missing.label");
    expect(() => historicalProgrammeLabelEn(snapshot, programme.itemId, 1900)).toThrow("1900");
  });
  it("uses only the supplied snapshot for full sentences and checks interpolation", () => {
    expect(serviceMessage(snapshot, "en", "missing.seriesYear", { year: 2025 })).toBe("No value is recorded for the selected series in 2025; this does not mean zero.");
    const edited = structuredClone(snapshot);
    edited.localization.messages.en["missing.seriesYear"] = "Reviewed absence in {year}.";
    expect(serviceMessage(edited, "en", "missing.seriesYear", { year: 2025 })).toBe("Reviewed absence in 2025.");
    expect(() => serviceMessage(snapshot, "en", "missing.seriesYear")).toThrow("year");
    const missing = structuredClone(snapshot);
    delete missing.localization.messages.en["missing.seriesYear"];
    expect(() => serviceMessage(missing, "en", "missing.seriesYear", { year: 2025 })).toThrow("missing.seriesYear");
  });
  it("hashes translation changes while excluding volatile build identity", () => {
    const corrected = structuredClone(snapshot);
    corrected.localization.labelsEn["spending.education"] = "Education expenditure";
    expect(hashDataVersion(corrected)).not.toBe(hashDataVersion(snapshot));
    expect(hashDataVersion({ ...snapshot, releaseCommit: "another", generatedAt: "2030-01-01T00:00:00Z" })).toBe(hashDataVersion(snapshot));
    expect(snapshot.localization.messages.en["publication.sumWarning"]).toContain("double-counts");
  });
  it("adds bilingual evidence without changing original descriptions and attributions", () => {
    const adjara = snapshot.sources.find(source => source.sourceId === "source.adjara_consolidated_budget")!;
    expect(adjara.name).toBe("Reviewed consolidated Adjara calculation — municipalities plus republican payments minus internal transfers");
    expect(adjara.nameKa).toMatch(/აჭარ/);
    expect(adjara.nameEn).toContain("Adjara");
    expect(adjara.derivationEn).not.toBeNull();
    expect(adjara.documents.every(document => document.role === "derivation_upstream")).toBe(true);
    for (const source of snapshot.sources) {
      expect(source.nameKa.trim()).not.toBe("");
      expect(source.nameEn).not.toMatch(/\p{Script=Georgian}/u);
      for (const document of source.documents) {
        expect(document.titleKa.trim()).not.toBe("");
        expect(document.titleEn).not.toMatch(/\p{Script=Georgian}/u);
        expect(document.publisherEn).not.toMatch(/\p{Script=Georgian}/u);
        expect(document.attribution === null).toBe(document.attributionKa === null);
        expect(document.attribution === null).toBe(document.attributionEn === null);
        // World Bank JSON, sector originals and English inflation originals (whose Georgian
        // twins sit beside them in the archive) declare their language.
        expect(document.documentLanguage).toBe(/^source\.(wb_gdp_|geostat_sector_|geostat_regional_gdp|geostat_cpi_|geostat_core_|nbg_inflation_target)/.test(document.documentId) ? 'en' : null);
      }
    }
    expect(Object.keys(snapshot.localization.messages.en).some(key => /^(sources|documents)\./.test(key))).toBe(false);
    const result = getSources(snapshot, { sourceIds: [adjara.sourceId] });
    if (result.kind !== "sources") throw new Error("Expected sources");
    const returned = (result.data as GetSourcesData).sources[0];
    expect(returned.nameKa).toBe(adjara.nameKa);
    expect(returned.derivationEn).toBe(adjara.derivationEn);
    expect(returned.documents).toEqual(adjara.documents);
    for (const source of result.meta.sources) for (const document of source.documents) {
      const restored = { ...source.documentDefaults, ...document };
      const original = returned.documents.find(candidate => candidate.documentId === document.documentId)!;
      expect(restored.publisherEn).toBe(original.publisherEn);
      expect(restored.attributionEn).toBe(original.attributionEn);
      expect(restored.titleEn).toBe(original.titleEn);
    }
  });
});
